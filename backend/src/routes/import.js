const express = require('express')
const router = express.Router()
const multer = require('multer')
const { protect } = require('../middleware/auth')
const { parsePDF, parseText } = require('../utils/pdfParser')
const Bill = require('../models/Bill')

// Configuração do multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Apenas arquivos PDF são permitidos'), false)
    }
  }
})

// Todas as rotas precisam de autenticação
router.use(protect)

// @route   POST /api/import/pdf
// @desc    Importar contas de um arquivo PDF
router.post('/pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado' })
    }

    console.log(`[IMPORT] Processando PDF de ${req.file.size} bytes`)

    // Processa o PDF
    const result = await parsePDF(req.file.buffer)

    if (!result.success) {
      return res.status(400).json({
        message: 'Erro ao processar PDF',
        error: result.error
      })
    }

    console.log(`[IMPORT] ${result.bills.length} contas extraídas do PDF`)

    res.json({
      success: true,
      bills: result.bills,
      totalPages: result.totalPages,
      preview: result.rawTextPreview
    })
  } catch (error) {
    console.error('[IMPORT] Erro:', error)
    res.status(500).json({ message: 'Erro ao processar arquivo', error: error.message })
  }
})

// @route   POST /api/import/text
// @desc    Importar contas de texto copiado
router.post('/text', async (req, res) => {
  try {
    const { text } = req.body

    if (!text || text.trim().length < 10) {
      return res.status(400).json({ message: 'Texto muito curto ou vazio' })
    }

    console.log(`[IMPORT] Processando texto de ${text.length} caracteres`)

    const result = parseText(text)

    console.log(`[IMPORT] ${result.bills.length} contas extraídas do texto`)

    res.json({
      success: true,
      bills: result.bills
    })
  } catch (error) {
    console.error('[IMPORT] Erro:', error)
    res.status(500).json({ message: 'Erro ao processar texto', error: error.message })
  }
})

// @route   POST /api/import/confirm
// @desc    Confirmar importação e criar contas no banco
router.post('/confirm', async (req, res) => {
  try {
    const { bills } = req.body

    if (!bills || !Array.isArray(bills) || bills.length === 0) {
      return res.status(400).json({ message: 'Nenhuma conta para importar' })
    }

    console.log(`[IMPORT] Confirmando importação de ${bills.length} contas`)

    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()

    const createdBills = []
    const errors = []

    for (const billData of bills) {
      try {
        // Valida dados mínimos
        if (!billData.name || !billData.amount || billData.amount <= 0) {
          errors.push({ bill: billData.name || 'Sem nome', error: 'Dados incompletos' })
          continue
        }

        // Determina o dia de vencimento (usa o dia informado ou dia 10 como padrão)
        const dueDay = billData.dueDay && billData.dueDay >= 1 && billData.dueDay <= 31
          ? billData.dueDay
          : 10

        // Determina mês e ano (usa os informados ou o mês atual)
        const month = billData.dueMonth || currentMonth
        const year = billData.dueYear || currentYear

        // Verifica se já existe uma conta similar
        const existingBill = await Bill.findOne({
          user: req.user._id,
          name: { $regex: new RegExp(`^${billData.name}$`, 'i') },
          currentMonth: month,
          currentYear: year
        })

        if (existingBill) {
          errors.push({ bill: billData.name, error: 'Conta já existe para este mês' })
          continue
        }

        // Cria a conta
        const bill = await Bill.create({
          user: req.user._id,
          name: billData.name,
          category: billData.category || 'outros',
          amount: billData.amount,
          dueDay,
          isRecurring: billData.isRecurring !== false,
          notes: billData.notes || `Importado automaticamente em ${new Date().toLocaleDateString('pt-BR')}`,
          currentMonth: month,
          currentYear: year
        })

        createdBills.push(bill)
      } catch (err) {
        errors.push({ bill: billData.name || 'Desconhecido', error: err.message })
      }
    }

    console.log(`[IMPORT] ${createdBills.length} contas criadas, ${errors.length} erros`)

    res.json({
      success: true,
      created: createdBills.length,
      errors: errors.length,
      bills: createdBills,
      errorDetails: errors
    })
  } catch (error) {
    console.error('[IMPORT] Erro:', error)
    res.status(500).json({ message: 'Erro ao criar contas', error: error.message })
  }
})

// @route   POST /api/import/manual
// @desc    Importação manual de múltiplas contas
router.post('/manual', async (req, res) => {
  try {
    const { bills } = req.body

    if (!bills || !Array.isArray(bills) || bills.length === 0) {
      return res.status(400).json({ message: 'Nenhuma conta para importar' })
    }

    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()

    const createdBills = []

    for (const billData of bills) {
      if (!billData.name || !billData.amount || !billData.dueDay) {
        continue
      }

      const bill = await Bill.create({
        user: req.user._id,
        name: billData.name,
        category: billData.category || 'outros',
        amount: billData.amount,
        dueDay: billData.dueDay,
        isRecurring: billData.isRecurring !== false,
        notes: billData.notes || '',
        currentMonth,
        currentYear
      })

      createdBills.push(bill)
    }

    res.json({
      success: true,
      created: createdBills.length,
      bills: createdBills
    })
  } catch (error) {
    console.error('[IMPORT] Erro:', error)
    res.status(500).json({ message: 'Erro ao importar contas', error: error.message })
  }
})

// Tratamento de erros do multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Arquivo muito grande. Máximo 10MB.' })
    }
  }
  if (error.message === 'Apenas arquivos PDF são permitidos') {
    return res.status(400).json({ message: error.message })
  }
  next(error)
})

module.exports = router
