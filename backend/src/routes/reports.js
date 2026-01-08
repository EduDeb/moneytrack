const express = require('express')
const router = express.Router()
const Transaction = require('../models/Transaction')
const Bill = require('../models/Bill')
const { protect } = require('../middleware/auth')
const XLSX = require('xlsx')
const PDFDocument = require('pdfkit')
const { roundMoney, sumMoney, subtractMoney } = require('../utils/moneyHelper')

router.use(protect)

// Labels de categorias
const categoryLabels = {
  salario: 'Salário', freelance: 'Freelance', investimentos: 'Investimentos',
  presente: 'Presente', outros_receita: 'Outros', outros: 'Outros',
  alimentacao: 'Alimentação', transporte: 'Transporte', moradia: 'Moradia',
  saude: 'Saúde', educacao: 'Educação', lazer: 'Lazer', compras: 'Compras',
  contas: 'Contas', assinaturas: 'Assinaturas', outros_despesa: 'Outros'
}

// Helpers - usando UTC para consistência com datas armazenadas no banco
const getDateRange = (period, customStart, customEnd) => {
  const now = new Date()
  let startDate, endDate

  switch (period) {
    case 'today':
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0))
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999))
      break
    case 'yesterday':
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      startDate = new Date(Date.UTC(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0))
      endDate = new Date(Date.UTC(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999))
      break
    case 'week':
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      startDate = new Date(Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 0, 0, 0, 0))
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999))
      break
    case 'last7days':
      const last7 = new Date(now)
      last7.setDate(now.getDate() - 7)
      startDate = new Date(Date.UTC(last7.getFullYear(), last7.getMonth(), last7.getDate(), 0, 0, 0, 0))
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999))
      break
    case 'last30days':
      const last30 = new Date(now)
      last30.setDate(now.getDate() - 30)
      startDate = new Date(Date.UTC(last30.getFullYear(), last30.getMonth(), last30.getDate(), 0, 0, 0, 0))
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999))
      break
    case 'month':
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0))
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999))
      break
    case 'lastMonth':
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0))
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999))
      break
    case 'year':
      startDate = new Date(Date.UTC(now.getFullYear(), 0, 1, 0, 0, 0, 0))
      endDate = new Date(Date.UTC(now.getFullYear(), 11, 31, 23, 59, 59, 999))
      break
    case 'custom':
      startDate = customStart ? new Date(customStart + 'T00:00:00.000Z') : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0))
      endDate = customEnd ? new Date(customEnd + 'T23:59:59.999Z') : new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999))
      break
    default:
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0))
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999))
  }

  return { startDate, endDate }
}

// @route   GET /api/reports/summary
// @desc    Resumo geral por período
router.get('/summary', async (req, res) => {
  try {
    const { period = 'month', startDate: customStart, endDate: customEnd, month, year } = req.query

    let startDate, endDate

    // Se passou mês e ano específicos (usar UTC para consistência)
    if (month && year) {
      startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1, 0, 0, 0, 0))
      endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 0, 23, 59, 59, 999))
    } else {
      const range = getDateRange(period, customStart, customEnd)
      startDate = range.startDate
      endDate = range.endDate
    }

    const transactions = await Transaction.find({
      user: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: -1 })

    // Calcular totais (usando funções monetárias para precisão)
    const income = sumMoney(...transactions.filter(t => t.type === 'income').map(t => t.amount))
    const expenses = sumMoney(...transactions.filter(t => t.type === 'expense').map(t => t.amount))
    const balance = subtractMoney(income, expenses)

    // Agrupar por categoria
    const byCategory = {}
    transactions.forEach(t => {
      if (!byCategory[t.category]) {
        byCategory[t.category] = { total: 0, count: 0, type: t.type }
      }
      byCategory[t.category].total += t.amount
      byCategory[t.category].count++
    })

    // Agrupar por dia para gráfico
    const byDay = {}
    transactions.forEach(t => {
      const dayKey = new Date(t.date).toISOString().split('T')[0]
      if (!byDay[dayKey]) {
        byDay[dayKey] = { income: 0, expense: 0 }
      }
      if (t.type === 'income') {
        byDay[dayKey].income += t.amount
      } else {
        byDay[dayKey].expense += t.amount
      }
    })

    // Converter para array ordenado
    const dailyData = Object.entries(byDay)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    // Dias no período - para mês atual, usar dias passados (não dias totais)
    let daysInPeriod = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Verificar se é o mês atual
    const isCurrentMonth = (
      (month && year && parseInt(month) === currentMonth && parseInt(year) === currentYear) ||
      (period === 'month' && !month && !year)
    )

    // Se for o mês atual, usar dias passados até hoje
    if (isCurrentMonth) {
      daysInPeriod = now.getDate()
    }

    const dailyAverage = roundMoney(expenses / (daysInPeriod || 1))

    res.json({
      period: { startDate, endDate, days: daysInPeriod },
      totals: { income, expenses, balance },
      byCategory,
      dailyData,
      dailyAverage,
      transactionCount: transactions.length
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao gerar relatório', error: error.message })
  }
})

// @route   GET /api/reports/compare
// @desc    Comparar dois períodos
router.get('/compare', async (req, res) => {
  try {
    const { month1, year1, month2, year2 } = req.query

    const period1Start = new Date(Date.UTC(parseInt(year1), parseInt(month1) - 1, 1, 0, 0, 0, 0))
    const period1End = new Date(Date.UTC(parseInt(year1), parseInt(month1), 0, 23, 59, 59, 999))
    const period2Start = new Date(Date.UTC(parseInt(year2), parseInt(month2) - 1, 1, 0, 0, 0, 0))
    const period2End = new Date(Date.UTC(parseInt(year2), parseInt(month2), 0, 23, 59, 59, 999))

    const [trans1, trans2] = await Promise.all([
      Transaction.find({ user: req.user._id, date: { $gte: period1Start, $lte: period1End } }),
      Transaction.find({ user: req.user._id, date: { $gte: period2Start, $lte: period2End } })
    ])

    const calc = (transactions) => ({
      income: transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expenses: transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      count: transactions.length
    })

    const p1 = calc(trans1)
    const p2 = calc(trans2)

    res.json({
      period1: { ...p1, balance: p1.income - p1.expenses, start: period1Start, end: period1End },
      period2: { ...p2, balance: p2.income - p2.expenses, start: period2Start, end: period2End },
      variation: {
        income: p1.income > 0 ? ((p2.income - p1.income) / p1.income * 100).toFixed(1) : null,
        expenses: p1.expenses > 0 ? ((p2.expenses - p1.expenses) / p1.expenses * 100).toFixed(1) : null
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao comparar períodos', error: error.message })
  }
})

// @route   GET /api/reports/export
// @desc    Exportar transações em múltiplos formatos (CSV, Excel, PDF, JSON)
router.get('/export', async (req, res) => {
  try {
    const { period = 'month', startDate: customStart, endDate: customEnd, format = 'csv', dataType = 'transactions' } = req.query
    const { startDate, endDate } = getDateRange(period, customStart, customEnd)

    let data = []
    let fileName = `moneytrack_${dataType}_${new Date().toISOString().split('T')[0]}`

    // Buscar dados baseado no tipo
    if (dataType === 'bills') {
      const bills = await Bill.find({ user: req.user._id }).sort({ dueDay: 1 })
      data = bills.map(b => ({
        nome: b.name,
        valor: b.amount,
        dia_vencimento: b.dueDay,
        categoria: categoryLabels[b.category] || b.category,
        status: b.isPaid ? 'Pago' : 'Pendente',
        recorrente: b.isRecurring ? 'Sim' : 'Não'
      }))
    } else {
      const transactions = await Transaction.find({
        user: req.user._id,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: -1 })

      data = transactions.map(t => ({
        data: new Date(t.date).toLocaleDateString('pt-BR'),
        tipo: t.type === 'income' ? 'Receita' : 'Despesa',
        categoria: categoryLabels[t.category] || t.category,
        descricao: t.description,
        valor: t.amount
      }))
    }

    // Gerar formato solicitado
    switch (format) {
      case 'csv': {
        if (data.length === 0) {
          return res.status(400).json({ message: 'Nenhum dado para exportar' })
        }
        const headers = Object.keys(data[0]).join(',')
        const rows = data.map(row =>
          Object.values(row).map(v =>
            typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` :
            typeof v === 'number' ? v.toFixed(2).replace('.', ',') : v
          ).join(',')
        ).join('\n')
        const csv = `${headers}\n${rows}`

        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}.csv`)
        return res.send('\uFEFF' + csv)
      }

      case 'excel': {
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Dados')

        // Ajustar largura das colunas
        const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }))
        ws['!cols'] = colWidths

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}.xlsx`)
        return res.send(buffer)
      }

      case 'pdf': {
        const doc = new PDFDocument({ margin: 50 })
        const chunks = []

        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks)
          res.setHeader('Content-Type', 'application/pdf')
          res.setHeader('Content-Disposition', `attachment; filename=${fileName}.pdf`)
          res.send(pdfBuffer)
        })

        // Título
        doc.fontSize(20).text('MoneyTrack - Relatório Financeiro', { align: 'center' })
        doc.moveDown()
        doc.fontSize(12).text(`Período: ${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`, { align: 'center' })
        doc.moveDown(2)

        if (dataType === 'transactions') {
          // Calcular totais
          const income = data.filter(d => d.tipo === 'Receita').reduce((s, d) => s + d.valor, 0)
          const expenses = data.filter(d => d.tipo === 'Despesa').reduce((s, d) => s + d.valor, 0)

          // Resumo
          doc.fontSize(14).text('Resumo', { underline: true })
          doc.fontSize(11)
          doc.fillColor('green').text(`Receitas: R$ ${income.toFixed(2).replace('.', ',')}`)
          doc.fillColor('red').text(`Despesas: R$ ${expenses.toFixed(2).replace('.', ',')}`)
          doc.fillColor(income - expenses >= 0 ? 'blue' : 'red')
             .text(`Saldo: R$ ${(income - expenses).toFixed(2).replace('.', ',')}`)
          doc.fillColor('black')
          doc.moveDown(2)

          // Por categoria
          doc.fontSize(14).text('Despesas por Categoria', { underline: true })
          doc.fontSize(10)
          const byCategory = {}
          data.filter(d => d.tipo === 'Despesa').forEach(d => {
            if (!byCategory[d.categoria]) byCategory[d.categoria] = 0
            byCategory[d.categoria] += d.valor
          })
          Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .forEach(([cat, val]) => {
              doc.text(`${cat}: R$ ${val.toFixed(2).replace('.', ',')}`)
            })
          doc.moveDown(2)
        }

        // Tabela de dados
        doc.fontSize(14).text('Detalhamento', { underline: true })
        doc.moveDown()
        doc.fontSize(9)

        // Header da tabela
        const headers = Object.keys(data[0] || {})
        let y = doc.y
        headers.forEach((h, i) => {
          doc.text(h.charAt(0).toUpperCase() + h.slice(1), 50 + (i * 100), y, { width: 95 })
        })
        doc.moveDown()
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
        doc.moveDown(0.5)

        // Linhas
        data.slice(0, 50).forEach((row, rowIndex) => { // Limitar a 50 linhas
          if (doc.y > 700) {
            doc.addPage()
          }
          y = doc.y
          Object.values(row).forEach((val, i) => {
            const text = typeof val === 'number' ? `R$ ${val.toFixed(2).replace('.', ',')}` : String(val)
            doc.text(text.substring(0, 15), 50 + (i * 100), y, { width: 95 })
          })
          doc.moveDown(0.5)
        })

        if (data.length > 50) {
          doc.moveDown()
          doc.text(`... e mais ${data.length - 50} registros`)
        }

        doc.end()
        return
      }

      case 'json':
      default:
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}.json`)
        return res.json({
          exportDate: new Date().toISOString(),
          period: { startDate, endDate },
          dataType,
          count: data.length,
          data
        })
    }
  } catch (error) {
    res.status(500).json({ message: 'Erro ao exportar', error: error.message })
  }
})

// @route   POST /api/reports/import
// @desc    Importar dados de múltiplos formatos com detecção automática
router.post('/import', async (req, res) => {
  try {
    const { data, dataType = 'auto' } = req.body

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ message: 'Dados inválidos para importação' })
    }

    // Mapear categorias
    const categoryMap = {
      'salário': 'salario', 'salario': 'salario',
      'freelance': 'freelance',
      'investimentos': 'investimentos', 'investimento': 'investimentos',
      'presente': 'presente',
      'outros': 'outros_despesa',
      'alimentação': 'alimentacao', 'alimentacao': 'alimentacao', 'comida': 'alimentacao', 'mercado': 'alimentacao', 'supermercado': 'alimentacao', 'restaurante': 'alimentacao',
      'transporte': 'transporte', 'uber': 'transporte', 'gasolina': 'transporte', 'combustível': 'transporte', 'combustivel': 'transporte',
      'moradia': 'moradia', 'aluguel': 'moradia', 'casa': 'moradia', 'condomínio': 'moradia', 'condominio': 'moradia',
      'saúde': 'saude', 'saude': 'saude', 'farmácia': 'saude', 'farmacia': 'saude', 'médico': 'saude', 'medico': 'saude',
      'educação': 'educacao', 'educacao': 'educacao', 'escola': 'educacao', 'curso': 'educacao', 'faculdade': 'educacao',
      'lazer': 'lazer', 'entretenimento': 'lazer', 'diversão': 'lazer',
      'compras': 'compras', 'shopping': 'compras', 'roupa': 'compras', 'roupas': 'compras',
      'contas': 'contas', 'conta': 'contas', 'luz': 'contas', 'água': 'contas', 'internet': 'contas', 'telefone': 'contas',
      'assinaturas': 'assinaturas', 'assinatura': 'assinaturas', 'streaming': 'assinaturas', 'netflix': 'assinaturas', 'spotify': 'assinaturas'
    }

    // Detectar tipo de dado
    const sample = data[0]
    const hasDate = sample.data || sample.date || sample.Data
    const hasDueDay = sample.dia_vencimento || sample.dueDay || sample.vencimento
    const detectedType = dataType !== 'auto' ? dataType : (hasDueDay ? 'bills' : 'transactions')

    const imported = []
    const errors = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      try {
        if (detectedType === 'bills') {
          // Importar como conta a pagar
          const name = row.nome || row.name || row.descricao || row.descrição || 'Conta Importada'
          let amount = row.valor || row.value || row.amount || 0
          if (typeof amount === 'string') {
            amount = parseFloat(amount.replace(/\./g, '').replace(',', '.'))
          }
          const dueDay = parseInt(row.dia_vencimento || row.dueDay || row.vencimento || 1)
          const categoryKey = (row.categoria || row.category || 'contas').toLowerCase()
          const category = categoryMap[categoryKey] || 'contas'

          const bill = await Bill.create({
            user: req.user._id,
            name,
            amount,
            dueDay: Math.min(Math.max(dueDay, 1), 31),
            category,
            isRecurring: true,
            isPaid: false
          })
          imported.push({ type: 'bill', data: bill })
        } else {
          // Importar como transação
          const type = (row.tipo || row.type || 'expense').toLowerCase().includes('receita') ||
                       (row.tipo || row.type || '').toLowerCase() === 'income' ? 'income' : 'expense'

          const categoryKey = (row.categoria || row.category || '').toLowerCase()
          let category = categoryMap[categoryKey]
          if (!category) {
            category = type === 'income' ? 'outros_receita' : 'outros_despesa'
          }

          // Parse da data
          let date
          const dateStr = row.data || row.date || row.Data
          if (dateStr) {
            if (typeof dateStr === 'string' && dateStr.includes('/')) {
              const parts = dateStr.split('/')
              if (parts[0].length === 4) { // yyyy/mm/dd
                date = new Date(parts[0], parts[1] - 1, parts[2])
              } else { // dd/mm/yyyy
                date = new Date(parts[2], parts[1] - 1, parts[0])
              }
            } else {
              date = new Date(dateStr)
            }
          } else {
            date = new Date()
          }

          // Parse do valor
          let amount = row.valor || row.value || row.amount || 0
          if (typeof amount === 'string') {
            amount = parseFloat(amount.replace(/\./g, '').replace(',', '.'))
          }
          amount = Math.abs(amount) // Garantir valor positivo

          const description = row.descricao || row.descrição || row.description || row.nome || categoryLabels[category] || 'Importado'

          const transaction = await Transaction.create({
            user: req.user._id,
            type,
            category,
            description,
            amount,
            date
          })
          imported.push({ type: 'transaction', data: transaction })
        }
      } catch (err) {
        errors.push({ row: i + 1, data: row, error: err.message })
      }
    }

    // Agrupar resultados
    const summary = {
      total: imported.length,
      transactions: imported.filter(i => i.type === 'transaction').length,
      bills: imported.filter(i => i.type === 'bill').length
    }

    res.json({
      message: `${imported.length} registros importados com sucesso`,
      summary,
      errors: errors.length,
      errorDetails: errors.slice(0, 10) // Limitar detalhes de erro
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao importar', error: error.message })
  }
})

// @route   GET /api/reports/yearly
// @desc    Resumo anual com todos os meses
router.get('/yearly', async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query
    const yearInt = parseInt(year)

    const startDate = new Date(Date.UTC(yearInt, 0, 1, 0, 0, 0, 0))
    const endDate = new Date(Date.UTC(yearInt, 11, 31, 23, 59, 59, 999))

    const transactions = await Transaction.find({
      user: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    })

    // Agrupar por mês
    const monthlyData = Array(12).fill(null).map((_, i) => ({
      month: i + 1,
      monthName: new Date(yearInt, i, 1).toLocaleDateString('pt-BR', { month: 'short' }),
      income: 0,
      expenses: 0,
      balance: 0
    }))

    transactions.forEach(t => {
      // Usar getUTCMonth() para manter consistência com datas UTC armazenadas no banco
      const month = new Date(t.date).getUTCMonth()
      if (t.type === 'income') {
        monthlyData[month].income += t.amount
      } else {
        monthlyData[month].expenses += t.amount
      }
      monthlyData[month].balance = monthlyData[month].income - monthlyData[month].expenses
    })

    // Totais do ano
    const yearTotal = {
      income: monthlyData.reduce((s, m) => s + m.income, 0),
      expenses: monthlyData.reduce((s, m) => s + m.expenses, 0)
    }
    yearTotal.balance = yearTotal.income - yearTotal.expenses

    res.json({
      year: yearInt,
      monthlyData,
      yearTotal
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao gerar relatório anual', error: error.message })
  }
})

// @route   GET /api/reports/export/all
// @desc    Exportar todos os dados do usuário (backup completo)
router.get('/export/all', async (req, res) => {
  try {
    const { format = 'json' } = req.query

    const [transactions, bills] = await Promise.all([
      Transaction.find({ user: req.user._id }).sort({ date: -1 }),
      Bill.find({ user: req.user._id }).sort({ dueDay: 1 })
    ])

    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      transactions: transactions.map(t => ({
        date: t.date,
        type: t.type,
        category: t.category,
        description: t.description,
        amount: t.amount
      })),
      bills: bills.map(b => ({
        name: b.name,
        amount: b.amount,
        dueDay: b.dueDay,
        category: b.category,
        isRecurring: b.isRecurring
      })),
      summary: {
        totalTransactions: transactions.length,
        totalBills: bills.length
      }
    }

    const fileName = `moneytrack_backup_${new Date().toISOString().split('T')[0]}`

    if (format === 'excel') {
      const wb = XLSX.utils.book_new()

      // Aba de transações
      const wsTransactions = XLSX.utils.json_to_sheet(exportData.transactions.map(t => ({
        Data: new Date(t.date).toLocaleDateString('pt-BR'),
        Tipo: t.type === 'income' ? 'Receita' : 'Despesa',
        Categoria: categoryLabels[t.category] || t.category,
        Descrição: t.description,
        Valor: t.amount
      })))
      XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transações')

      // Aba de contas
      const wsBills = XLSX.utils.json_to_sheet(exportData.bills.map(b => ({
        Nome: b.name,
        Valor: b.amount,
        'Dia Vencimento': b.dueDay,
        Categoria: categoryLabels[b.category] || b.category,
        Recorrente: b.isRecurring ? 'Sim' : 'Não'
      })))
      XLSX.utils.book_append_sheet(wb, wsBills, 'Contas')

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}.xlsx`)
      return res.send(buffer)
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}.json`)
    res.json(exportData)
  } catch (error) {
    res.status(500).json({ message: 'Erro ao exportar backup', error: error.message })
  }
})

// @route   GET /api/reports/export/bills
// @desc    Exportar contas a pagar com filtros (mês, ano, status)
router.get('/export/bills', async (req, res) => {
  try {
    const { month, year, format = 'pdf', status = 'all' } = req.query
    const m = parseInt(month) || new Date().getMonth() + 1
    const y = parseInt(year) || new Date().getFullYear()

    const Recurring = require('../models/Recurring')
    const RecurringPayment = require('../models/RecurringPayment')

    // 1. Buscar Bills diretas do mês
    const billQuery = {
      user: req.user._id,
      currentMonth: m,
      currentYear: y
    }
    if (status === 'pending') billQuery.isPaid = false
    else if (status === 'paid') billQuery.isPaid = true

    const directBills = await Bill.find(billQuery).sort({ dueDay: 1 })

    // 2. Buscar Recurring (despesas recorrentes) ativas
    const recurrings = await Recurring.find({
      user: req.user._id,
      isActive: true,
      type: 'expense'
    })

    // 3. Buscar pagamentos de recorrentes neste mês
    const payments = await RecurringPayment.find({
      user: req.user._id,
      month: m,
      year: y
    })
    const paidRecurringIds = new Set(payments.map(p => p.recurring.toString()))

    // Processar Bills diretas
    const processedDirectBills = directBills.map(b => ({
      nome: b.name,
      categoria: categoryLabels[b.category] || b.category,
      valor: b.amount,
      dia_vencimento: b.dueDay,
      status: b.isPaid ? 'Pago' : 'Pendente',
      valor_pago: b.isPaid ? b.amount : null,
      data_pagamento: b.isPaid && b.paidAt ? new Date(b.paidAt).toLocaleDateString('pt-BR') : null,
      recorrente: 'Não'
    }))

    // Processar Recurring como bills
    const processedRecurrings = recurrings.map(r => {
      const isPaid = paidRecurringIds.has(r._id.toString())
      const dueDay = r.dayOfMonth || new Date(r.startDate).getDate()
      return {
        nome: r.name,
        categoria: categoryLabels[r.category] || r.category,
        valor: r.amount,
        dia_vencimento: dueDay,
        status: isPaid ? 'Pago' : 'Pendente',
        valor_pago: isPaid ? r.amount : null,
        data_pagamento: null,
        recorrente: 'Sim'
      }
    })

    // Combinar e ordenar por dia de vencimento
    let allBills = [...processedDirectBills, ...processedRecurrings]
      .sort((a, b) => a.dia_vencimento - b.dia_vencimento)

    // Filtrar por status se necessário
    if (status === 'pending') {
      allBills = allBills.filter(b => b.status === 'Pendente')
    } else if (status === 'paid') {
      allBills = allBills.filter(b => b.status === 'Pago')
    }

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

    const filteredBills = allBills

    const fileName = `contas_${m}_${y}_${status}`

    // Calcular totais
    const totalAmount = filteredBills.reduce((s, b) => s + b.valor, 0)
    const totalPending = filteredBills.filter(b => b.status === 'Pendente').reduce((s, b) => s + b.valor, 0)
    const totalPaid = filteredBills.filter(b => b.status === 'Pago').reduce((s, b) => s + (b.valor_pago || b.valor), 0)

    switch (format) {
      case 'csv': {
        if (filteredBills.length === 0) {
          return res.status(400).json({ message: 'Nenhuma conta para exportar' })
        }
        const headers = ['nome', 'categoria', 'valor', 'dia_vencimento', 'status', 'recorrente']
        const headerRow = headers.join(',')
        const rows = filteredBills.map(row =>
          headers.map(h =>
            typeof row[h] === 'string' ? `"${row[h].replace(/"/g, '""')}"` :
            typeof row[h] === 'number' ? row[h].toFixed(2).replace('.', ',') : row[h]
          ).join(',')
        ).join('\n')
        const csv = `${headerRow}\n${rows}`

        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}.csv`)
        return res.send('\uFEFF' + csv)
      }

      case 'excel': {
        const data = filteredBills.map(b => ({
          Nome: b.nome,
          Categoria: b.categoria,
          Valor: b.valor,
          'Dia Vencimento': b.dia_vencimento,
          Status: b.status,
          'Valor Pago': b.valor_pago || '',
          'Data Pagamento': b.data_pagamento || '',
          Recorrente: b.recorrente
        }))
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Contas')
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}.xlsx`)
        return res.send(buffer)
      }

      case 'pdf': {
        const doc = new PDFDocument({ margin: 50 })
        const chunks = []

        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks)
          res.setHeader('Content-Type', 'application/pdf')
          res.setHeader('Content-Disposition', `attachment; filename=${fileName}.pdf`)
          res.send(pdfBuffer)
        })

        // Título
        doc.fontSize(20).text('MoneyTrack - Contas a Pagar', { align: 'center' })
        doc.moveDown()
        doc.fontSize(12).text(`${monthNames[m - 1]} de ${y}`, { align: 'center' })
        doc.moveDown(2)

        // Resumo
        doc.fontSize(14).text('Resumo', { underline: true })
        doc.fontSize(11)
        doc.text(`Total de contas: ${filteredBills.length}`)
        doc.text(`Valor total: R$ ${totalAmount.toFixed(2).replace('.', ',')}`)
        doc.fillColor('red').text(`Pendente: R$ ${totalPending.toFixed(2).replace('.', ',')}`)
        doc.fillColor('green').text(`Pago: R$ ${totalPaid.toFixed(2).replace('.', ',')}`)
        doc.fillColor('black')
        doc.moveDown(2)

        // Tabela
        doc.fontSize(14).text('Detalhamento', { underline: true })
        doc.moveDown()
        doc.fontSize(9)

        // Header
        const headers = ['Nome', 'Categoria', 'Venc.', 'Valor', 'Status']
        const colWidths = [150, 100, 40, 80, 60]
        let x = 50
        let y = doc.y
        headers.forEach((h, i) => {
          doc.font('Helvetica-Bold').text(h, x, y, { width: colWidths[i] })
          x += colWidths[i]
        })
        doc.font('Helvetica')
        doc.moveDown()
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
        doc.moveDown(0.5)

        // Linhas
        filteredBills.forEach(bill => {
          if (doc.y > 700) {
            doc.addPage()
          }
          x = 50
          y = doc.y
          doc.text(bill.nome.substring(0, 25), x, y, { width: colWidths[0] })
          x += colWidths[0]
          doc.text(bill.categoria.substring(0, 15), x, y, { width: colWidths[1] })
          x += colWidths[1]
          doc.text(String(bill.dia_vencimento), x, y, { width: colWidths[2] })
          x += colWidths[2]
          doc.text(`R$ ${bill.valor.toFixed(2).replace('.', ',')}`, x, y, { width: colWidths[3] })
          x += colWidths[3]
          doc.fillColor(bill.status === 'Pago' ? 'green' : 'red')
             .text(bill.status, x, y, { width: colWidths[4] })
          doc.fillColor('black')
          doc.moveDown(0.5)
        })

        doc.end()
        return
      }

      case 'json':
      default: {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}.json`)
        return res.json({
          month: m,
          year: y,
          status,
          summary: { total: totalAmount, pending: totalPending, paid: totalPaid, count: filteredBills.length },
          bills: filteredBills
        })
      }
    }
  } catch (error) {
    console.error('Erro ao exportar contas:', error)
    res.status(500).json({ message: 'Erro ao exportar contas', error: error.message })
  }
})

module.exports = router
