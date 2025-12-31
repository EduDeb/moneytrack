import { useState, useEffect, useContext } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import {
  FileText, Download, Upload, Calendar, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Filter,
  BarChart2, PieChart as PieChartIcon, X, FileSpreadsheet, File, Database
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts'
import { ThemeContext } from '../contexts/ThemeContext'
import { useCategories } from '../contexts/CategoriesContext'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316']

const periodOptions = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'week', label: 'Esta Semana' },
  { value: 'last7days', label: 'Últimos 7 dias' },
  { value: 'month', label: 'Este Mês' },
  { value: 'lastMonth', label: 'Mês Passado' },
  { value: 'last30days', label: 'Últimos 30 dias' },
  { value: 'year', label: 'Este Ano' },
  { value: 'custom', label: 'Personalizado' }
]

const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function Reports() {
  const { colors, isDark } = useContext(ThemeContext)
  const { categoryLabels, getCategoryLabel } = useCategories()
  const [period, setPeriod] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [report, setReport] = useState(null)
  const [yearlyReport, setYearlyReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showImportModal, setShowImportModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [importData, setImportData] = useState('')
  const [importType, setImportType] = useState('auto')
  const [exportFormat, setExportFormat] = useState('csv')
  const [exportDataType, setExportDataType] = useState('transactions')
  const [compareMonth1, setCompareMonth1] = useState(new Date().getMonth())
  const [compareMonth2, setCompareMonth2] = useState(new Date().getMonth() + 1)
  const [compareYear, setCompareYear] = useState(new Date().getFullYear())
  const [comparison, setComparison] = useState(null)

  useEffect(() => {
    fetchReport()
    fetchYearlyReport()
  }, [period, selectedMonth, selectedYear, customStart, customEnd])

  const fetchReport = async () => {
    setLoading(true)
    try {
      let url = '/reports/summary?'
      if (period === 'custom' && customStart && customEnd) {
        url += `period=custom&startDate=${customStart}&endDate=${customEnd}`
      } else if (period === 'month' || period === 'lastMonth') {
        url += `month=${selectedMonth}&year=${selectedYear}`
      } else {
        url += `period=${period}`
      }

      const response = await api.get(url)
      setReport(response.data)
    } catch (error) {
      console.error('Erro ao buscar relatório:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchYearlyReport = async () => {
    try {
      const response = await api.get(`/reports/yearly?year=${selectedYear}`)
      setYearlyReport(response.data)
    } catch (error) {
      console.error('Erro ao buscar relatório anual:', error)
    }
  }

  const fetchComparison = async () => {
    try {
      const response = await api.get(
        `/reports/compare?month1=${compareMonth1}&year1=${compareYear}&month2=${compareMonth2}&year2=${compareYear}`
      )
      setComparison(response.data)
    } catch (error) {
      console.error('Erro ao comparar:', error)
    }
  }

  const handleExport = async (format = exportFormat, dataType = exportDataType) => {
    try {
      let url = `/reports/export?format=${format}&dataType=${dataType}&`
      if (period === 'custom' && customStart && customEnd) {
        url += `period=custom&startDate=${customStart}&endDate=${customEnd}`
      } else {
        url += `period=${period}`
      }

      const mimeTypes = {
        csv: 'text/csv;charset=utf-8;',
        excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        pdf: 'application/pdf',
        json: 'application/json'
      }

      const extensions = { csv: 'csv', excel: 'xlsx', pdf: 'pdf', json: 'json' }

      const response = await api.get(url, { responseType: 'blob' })
      const blob = new Blob([response.data], { type: mimeTypes[format] })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `moneytrack_${dataType}_${new Date().toISOString().split('T')[0]}.${extensions[format]}`
      link.click()
      setShowExportModal(false)
      toast.success('Exportação realizada com sucesso!')
    } catch (error) {
      console.error('Erro ao exportar:', error)
      toast.error('Erro ao exportar. Tente novamente.')
    }
  }

  const handleBackupExport = async (format = 'json') => {
    try {
      const url = `/reports/export/all?format=${format}`
      const response = await api.get(url, { responseType: 'blob' })
      const ext = format === 'excel' ? 'xlsx' : 'json'
      const blob = new Blob([response.data])
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `moneytrack_backup_${new Date().toISOString().split('T')[0]}.${ext}`
      link.click()
    } catch (error) {
      console.error('Erro ao exportar backup:', error)
    }
  }

  const handleImport = async () => {
    try {
      // Parse CSV/texto
      const lines = importData.trim().split('\n')
      const firstLine = lines[0].toLowerCase()

      // Detectar separador (vírgula, ponto-e-vírgula ou tab)
      let separator = ','
      if (firstLine.includes(';')) separator = ';'
      else if (firstLine.includes('\t')) separator = '\t'

      const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ''))
      const data = []

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue // Pular linhas vazias

        // Parse respeitando aspas
        const values = []
        let current = ''
        let inQuotes = false
        for (const char of lines[i]) {
          if (char === '"') inQuotes = !inQuotes
          else if (char === separator && !inQuotes) {
            values.push(current.trim().replace(/"/g, ''))
            current = ''
          } else {
            current += char
          }
        }
        values.push(current.trim().replace(/"/g, ''))

        const row = {}
        headers.forEach((h, idx) => {
          row[h] = values[idx] || ''
        })
        data.push(row)
      }

      const response = await api.post('/reports/import', { data, dataType: importType })

      let message = response.data.message
      if (response.data.summary) {
        message += ` | Transações: ${response.data.summary.transactions}, Contas: ${response.data.summary.bills}`
      }
      if (response.data.errors > 0) {
        toast.error(`${response.data.errors} registro(s) com erro`)
      }

      toast.success(message)
      setShowImportModal(false)
      setImportData('')
      setImportType('auto')
      fetchReport()
    } catch (error) {
      toast.error('Erro ao importar: ' + (error.response?.data?.message || error.message))
    }
  }

  const navigateMonth = (direction) => {
    let newMonth = selectedMonth + direction
    let newYear = selectedYear

    if (newMonth > 12) {
      newMonth = 1
      newYear++
    } else if (newMonth < 1) {
      newMonth = 12
      newYear--
    }

    setSelectedMonth(newMonth)
    setSelectedYear(newYear)
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  // Preparar dados para gráficos
  const getCategoryChartData = () => {
    if (!report?.byCategory) return []
    return Object.entries(report.byCategory)
      .filter(([cat, data]) => data.type === 'expense')
      .map(([cat, data]) => ({
        name: categoryLabels[cat] || cat,
        value: data.total
      }))
      .sort((a, b) => b.value - a.value)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>Relatórios</h1>
          <p style={{ fontSize: '14px', color: colors.textSecondary, marginTop: '4px' }}>
            Análises detalhadas das suas finanças
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowImportModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
              backgroundColor: isDark ? colors.border : '#f3f4f6', color: colors.text, border: 'none',
              borderRadius: '8px', fontWeight: '500', cursor: 'pointer'
            }}
          >
            <Upload size={18} />
            Importar
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
              backgroundColor: '#3b82f6', color: 'white', border: 'none',
              borderRadius: '8px', fontWeight: '500', cursor: 'pointer'
            }}
          >
            <Download size={18} />
            Exportar
          </button>
        </div>
      </div>

      {/* Seletor de Período */}
      <div style={{
        backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '16px',
        marginBottom: '24px', border: `1px solid ${colors.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Navegação rápida de mês */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: isDark ? colors.border : '#f3f4f6', borderRadius: '8px', padding: '4px' }}>
            <button
              onClick={() => navigateMonth(-1)}
              style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px' }}
            >
              <ChevronLeft size={20} color={colors.textSecondary} />
            </button>
            <span style={{ fontWeight: '600', minWidth: '140px', textAlign: 'center', color: colors.text }}>
              {monthNames[selectedMonth - 1]} {selectedYear}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px' }}
            >
              <ChevronRight size={20} color={colors.textSecondary} />
            </button>
          </div>

          {/* Seletor de período predefinido */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`,
              fontSize: '14px', backgroundColor: colors.backgroundCard, color: colors.text
            }}
          >
            {periodOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Período personalizado */}
          {period === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard, color: colors.text }}
              />
              <span style={{ color: colors.textSecondary }}>até</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard, color: colors.text }}
              />
            </div>
          )}

          {/* Seletor de ano */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            style={{
              padding: '10px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`, fontSize: '14px',
              backgroundColor: colors.backgroundCard, color: colors.text
            }}
          >
            {[2023, 2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', backgroundColor: isDark ? colors.border : '#f3f4f6', borderRadius: '10px', padding: '4px' }}>
        {[
          { id: 'overview', label: 'Visão Geral', icon: BarChart2 },
          { id: 'categories', label: 'Categorias', icon: PieChartIcon },
          { id: 'compare', label: 'Comparar', icon: TrendingUp },
          { id: 'yearly', label: 'Anual', icon: Calendar }
        ].map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                if (tab.id === 'compare') fetchComparison()
              }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                backgroundColor: activeTab === tab.id ? colors.backgroundCard : 'transparent',
                color: activeTab === tab.id ? colors.text : colors.textSecondary,
                fontWeight: activeTab === tab.id ? '600' : '400',
                boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary }}>Carregando...</div>
      ) : (
        <>
          {/* Tab: Visão Geral */}
          {activeTab === 'overview' && report && (
            <div>
              {/* Cards de totais */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <TrendingUp size={18} color="#22c55e" />
                    <span style={{ fontSize: '13px', color: colors.textSecondary }}>Receitas</span>
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>
                    {formatCurrency(report.totals?.income)}
                  </p>
                </div>

                <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <TrendingDown size={18} color="#ef4444" />
                    <span style={{ fontSize: '13px', color: colors.textSecondary }}>Despesas</span>
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>
                    {formatCurrency(report.totals?.expenses)}
                  </p>
                </div>

                <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <FileText size={18} color="#3b82f6" />
                    <span style={{ fontSize: '13px', color: colors.textSecondary }}>Saldo</span>
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: '700', color: report.totals?.balance >= 0 ? '#22c55e' : '#ef4444' }}>
                    {formatCurrency(report.totals?.balance)}
                  </p>
                </div>

                <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Calendar size={18} color="#8b5cf6" />
                    <span style={{ fontSize: '13px', color: colors.textSecondary }}>Média/dia</span>
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: '700', color: '#8b5cf6' }}>
                    {formatCurrency(report.dailyAverage)}
                  </p>
                </div>
              </div>

              {/* Gráfico de evolução diária */}
              {report.dailyData?.length > 0 && (
                <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.border}` }}>
                  <h3 style={{ fontWeight: '600', marginBottom: '16px', color: colors.text }}>Evolução Diária</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={report.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                      <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} tick={{ fill: colors.textSecondary }} />
                      <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} tick={{ fill: colors.textSecondary }} />
                      <Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={(d) => new Date(d).toLocaleDateString('pt-BR')} contentStyle={{ backgroundColor: colors.backgroundCard, border: `1px solid ${colors.border}`, color: colors.text }} />
                      <Legend wrapperStyle={{ color: colors.text }} />
                      <Bar dataKey="income" name="Receitas" fill="#22c55e" />
                      <Bar dataKey="expense" name="Despesas" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Tab: Categorias */}
          {activeTab === 'categories' && report && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
              {/* Gráfico de pizza */}
              <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.border}` }}>
                <h3 style={{ fontWeight: '600', marginBottom: '16px', color: colors.text }}>Despesas por Categoria</h3>
                {getCategoryChartData().length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={getCategoryChartData()}
                        cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                        paddingAngle={2} dataKey="value"
                      >
                        {getCategoryChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ backgroundColor: colors.backgroundCard, border: `1px solid ${colors.border}`, color: colors.text }} />
                      <Legend wrapperStyle={{ color: colors.text }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p style={{ textAlign: 'center', color: colors.textSecondary, padding: '60px 0' }}>Sem dados</p>
                )}
              </div>

              {/* Lista de categorias */}
              <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.border}` }}>
                <h3 style={{ fontWeight: '600', marginBottom: '16px', color: colors.text }}>Detalhamento</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {getCategoryChartData().map((cat, i) => {
                    const total = report.totals?.expenses || 1
                    const pct = (cat.value / total * 100).toFixed(1)
                    return (
                      <div key={cat.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '14px', color: colors.text }}>{cat.name}</span>
                          <div>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>
                              {formatCurrency(cat.value)}
                            </span>
                            <span style={{ fontSize: '12px', color: colors.textSecondary, marginLeft: '8px' }}>
                              {pct}%
                            </span>
                          </div>
                        </div>
                        <div style={{ height: '6px', backgroundColor: isDark ? colors.border : '#f3f4f6', borderRadius: '3px' }}>
                          <div style={{
                            height: '100%', width: `${pct}%`,
                            backgroundColor: COLORS[i % COLORS.length], borderRadius: '3px'
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Comparar */}
          {activeTab === 'compare' && (
            <div>
              <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', marginBottom: '24px', border: `1px solid ${colors.border}` }}>
                <h3 style={{ fontWeight: '600', marginBottom: '16px', color: colors.text }}>Comparar Meses</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <select
                    value={compareMonth1}
                    onChange={(e) => setCompareMonth1(parseInt(e.target.value))}
                    style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard, color: colors.text }}
                  >
                    {monthNames.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <span style={{ color: colors.textSecondary }}>vs</span>
                  <select
                    value={compareMonth2}
                    onChange={(e) => setCompareMonth2(parseInt(e.target.value))}
                    style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard, color: colors.text }}
                  >
                    {monthNames.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={compareYear}
                    onChange={(e) => setCompareYear(parseInt(e.target.value))}
                    style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard, color: colors.text }}
                  >
                    {[2023, 2024, 2025].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <button
                    onClick={fetchComparison}
                    style={{
                      padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white',
                      border: 'none', borderRadius: '8px', fontWeight: '500', cursor: 'pointer'
                    }}
                  >
                    Comparar
                  </button>
                </div>
              </div>

              {comparison && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                  {/* Período 1 */}
                  <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.border}` }}>
                    <h4 style={{ fontWeight: '600', marginBottom: '16px', color: colors.textSecondary }}>
                      {monthNames[compareMonth1 - 1]} {compareYear}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: colors.textSecondary }}>Receitas</span>
                        <span style={{ fontWeight: '600', color: '#22c55e' }}>{formatCurrency(comparison.period1?.income)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: colors.textSecondary }}>Despesas</span>
                        <span style={{ fontWeight: '600', color: '#ef4444' }}>{formatCurrency(comparison.period1?.expenses)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${colors.border}`, paddingTop: '12px' }}>
                        <span style={{ fontWeight: '600', color: colors.text }}>Saldo</span>
                        <span style={{ fontWeight: '700', color: comparison.period1?.balance >= 0 ? '#22c55e' : '#ef4444' }}>
                          {formatCurrency(comparison.period1?.balance)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Período 2 */}
                  <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.border}` }}>
                    <h4 style={{ fontWeight: '600', marginBottom: '16px', color: colors.textSecondary }}>
                      {monthNames[compareMonth2 - 1]} {compareYear}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: colors.textSecondary }}>Receitas</span>
                        <span style={{ fontWeight: '600', color: '#22c55e' }}>{formatCurrency(comparison.period2?.income)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: colors.textSecondary }}>Despesas</span>
                        <span style={{ fontWeight: '600', color: '#ef4444' }}>{formatCurrency(comparison.period2?.expenses)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${colors.border}`, paddingTop: '12px' }}>
                        <span style={{ fontWeight: '600', color: colors.text }}>Saldo</span>
                        <span style={{ fontWeight: '700', color: comparison.period2?.balance >= 0 ? '#22c55e' : '#ef4444' }}>
                          {formatCurrency(comparison.period2?.balance)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Variação */}
                  <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.border}` }}>
                    <h4 style={{ fontWeight: '600', marginBottom: '16px', color: colors.textSecondary }}>Variação</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: colors.textSecondary }}>Receitas</span>
                        {comparison.variation?.income && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {parseFloat(comparison.variation.income) > 0 ? (
                              <ArrowUpRight size={16} color="#22c55e" />
                            ) : (
                              <ArrowDownRight size={16} color="#ef4444" />
                            )}
                            <span style={{ fontWeight: '600', color: parseFloat(comparison.variation.income) > 0 ? '#22c55e' : '#ef4444' }}>
                              {Math.abs(parseFloat(comparison.variation.income))}%
                            </span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: colors.textSecondary }}>Despesas</span>
                        {comparison.variation?.expenses && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {parseFloat(comparison.variation.expenses) < 0 ? (
                              <ArrowDownRight size={16} color="#22c55e" />
                            ) : (
                              <ArrowUpRight size={16} color="#ef4444" />
                            )}
                            <span style={{ fontWeight: '600', color: parseFloat(comparison.variation.expenses) < 0 ? '#22c55e' : '#ef4444' }}>
                              {Math.abs(parseFloat(comparison.variation.expenses))}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Anual */}
          {activeTab === 'yearly' && yearlyReport && (
            <div>
              <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', marginBottom: '24px', border: `1px solid ${colors.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <h3 style={{ fontWeight: '600', color: colors.text }}>Resumo Anual - {yearlyReport.year}</h3>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: colors.textSecondary }}>Receitas: </span>
                      <span style={{ fontWeight: '600', color: '#22c55e' }}>{formatCurrency(yearlyReport.yearTotal?.income)}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: colors.textSecondary }}>Despesas: </span>
                      <span style={{ fontWeight: '600', color: '#ef4444' }}>{formatCurrency(yearlyReport.yearTotal?.expenses)}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: colors.textSecondary }}>Saldo: </span>
                      <span style={{ fontWeight: '600', color: yearlyReport.yearTotal?.balance >= 0 ? '#22c55e' : '#ef4444' }}>
                        {formatCurrency(yearlyReport.yearTotal?.balance)}
                      </span>
                    </div>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={yearlyReport.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                    <XAxis dataKey="monthName" tick={{ fill: colors.textSecondary }} />
                    <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} tick={{ fill: colors.textSecondary }} />
                    <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ backgroundColor: colors.backgroundCard, border: `1px solid ${colors.border}`, color: colors.text }} />
                    <Legend wrapperStyle={{ color: colors.text }} />
                    <Bar dataKey="income" name="Receitas" fill="#22c55e" />
                    <Bar dataKey="expenses" name="Despesas" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela mensal */}
              <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '12px', padding: '20px', border: `1px solid ${colors.border}`, overflowX: 'auto' }}>
                <h3 style={{ fontWeight: '600', marginBottom: '16px', color: colors.text }}>Detalhamento Mensal</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
                      <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: '13px', color: colors.textSecondary }}>Mês</th>
                      <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '13px', color: colors.textSecondary }}>Receitas</th>
                      <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '13px', color: colors.textSecondary }}>Despesas</th>
                      <th style={{ textAlign: 'right', padding: '12px 8px', fontSize: '13px', color: colors.textSecondary }}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyReport.monthlyData?.map((m, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={{ padding: '12px 8px', fontWeight: '500', color: colors.text }}>{monthNames[i]}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: '#22c55e' }}>{formatCurrency(m.income)}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: '#ef4444' }}>{formatCurrency(m.expenses)}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: m.balance >= 0 ? '#22c55e' : '#ef4444' }}>
                          {formatCurrency(m.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de Exportação */}
      {showExportModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px'
        }}>
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '24px', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>Exportar Dados</h2>
              <button onClick={() => setShowExportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color={colors.textSecondary} />
              </button>
            </div>

            {/* Tipo de dado */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: colors.text, fontSize: '14px' }}>
                O que exportar?
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { value: 'transactions', label: 'Transações', icon: FileText },
                  { value: 'bills', label: 'Contas a Pagar', icon: Calendar }
                ].map(opt => {
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setExportDataType(opt.value)}
                      style={{
                        flex: 1, padding: '12px', borderRadius: '8px',
                        border: exportDataType === opt.value ? '2px solid #3b82f6' : `1px solid ${colors.border}`,
                        backgroundColor: exportDataType === opt.value ? (isDark ? 'rgba(59,130,246,0.2)' : '#eff6ff') : colors.backgroundCard,
                        color: exportDataType === opt.value ? '#3b82f6' : colors.textSecondary,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                        cursor: 'pointer', fontWeight: exportDataType === opt.value ? '600' : '400'
                      }}
                    >
                      <Icon size={20} />
                      <span style={{ fontSize: '12px' }}>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Formato */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: colors.text, fontSize: '14px' }}>
                Formato
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {[
                  { value: 'csv', label: 'CSV', icon: FileText, color: '#22c55e' },
                  { value: 'excel', label: 'Excel', icon: FileSpreadsheet, color: '#16a34a' },
                  { value: 'pdf', label: 'PDF', icon: File, color: '#ef4444' },
                  { value: 'json', label: 'JSON', icon: Database, color: '#8b5cf6' }
                ].map(opt => {
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setExportFormat(opt.value)}
                      style={{
                        padding: '12px 8px', borderRadius: '8px',
                        border: exportFormat === opt.value ? `2px solid ${opt.color}` : `1px solid ${colors.border}`,
                        backgroundColor: exportFormat === opt.value ? `${opt.color}15` : colors.backgroundCard,
                        color: exportFormat === opt.value ? opt.color : colors.textSecondary,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                        cursor: 'pointer', fontWeight: exportFormat === opt.value ? '600' : '400'
                      }}
                    >
                      <Icon size={18} />
                      <span style={{ fontSize: '11px' }}>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Período selecionado */}
            <div style={{ backgroundColor: isDark ? colors.border : '#f9fafb', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
              <p style={{ fontSize: '12px', color: colors.textSecondary }}>Período: <strong style={{ color: colors.text }}>{periodOptions.find(p => p.value === period)?.label || 'Este Mês'}</strong></p>
              <p style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '4px' }}>
                {monthNames[selectedMonth - 1]} {selectedYear}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px',
                  border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard, color: colors.text, fontWeight: '500', cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleExport()}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px',
                  border: 'none', backgroundColor: '#3b82f6', color: 'white',
                  fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <Download size={18} />
                Exportar
              </button>
            </div>

            {/* Backup completo */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: `1px solid ${colors.border}` }}>
              <p style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '8px' }}>Ou exporte todos os dados:</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleBackupExport('json')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px',
                    border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard, fontSize: '13px', color: colors.text,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}
                >
                  <Database size={16} color="#8b5cf6" />
                  Backup JSON
                </button>
                <button
                  onClick={() => handleBackupExport('excel')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px',
                    border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard, fontSize: '13px', color: colors.text,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}
                >
                  <FileSpreadsheet size={16} color="#16a34a" />
                  Backup Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Importação */}
      {showImportModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px'
        }}>
          <div style={{ backgroundColor: colors.backgroundCard, borderRadius: '16px', width: '100%', maxWidth: '550px', padding: '24px', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>Importar Dados</h2>
              <button onClick={() => setShowImportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color={colors.textSecondary} />
              </button>
            </div>

            {/* Tipo de importação */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: colors.text, fontSize: '14px' }}>
                Tipo de dados
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { value: 'auto', label: 'Detectar automaticamente' },
                  { value: 'transactions', label: 'Transações' },
                  { value: 'bills', label: 'Contas a Pagar' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setImportType(opt.value)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px',
                      border: importType === opt.value ? '2px solid #3b82f6' : `1px solid ${colors.border}`,
                      backgroundColor: importType === opt.value ? (isDark ? 'rgba(59,130,246,0.2)' : '#eff6ff') : colors.backgroundCard,
                      color: importType === opt.value ? '#3b82f6' : colors.textSecondary,
                      fontSize: '12px', cursor: 'pointer', fontWeight: importType === opt.value ? '600' : '400'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : '#f0fdf4', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', color: '#22c55e', fontWeight: '500', marginBottom: '4px' }}>Formatos aceitos:</p>
              <ul style={{ fontSize: '11px', color: isDark ? '#4ade80' : '#15803d', margin: 0, paddingLeft: '16px' }}>
                <li>CSV com separador vírgula, ponto-e-vírgula ou tab</li>
                <li>Primeira linha deve conter os cabeçalhos</li>
                <li>Datas: dd/mm/yyyy ou yyyy-mm-dd</li>
                <li>Valores: 1234.56 ou 1.234,56</li>
              </ul>
            </div>

            <p style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '8px' }}>
              <strong style={{ color: colors.text }}>Transações:</strong> data, tipo, categoria, descricao, valor<br />
              <strong style={{ color: colors.text }}>Contas:</strong> nome, valor, dia_vencimento, categoria
            </p>

            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="data,tipo,categoria,descricao,valor&#10;01/12/2024,Despesa,Alimentação,Almoço,45.90&#10;05/12/2024,Receita,Salário,Salário dezembro,5000"
              style={{
                width: '100%', height: '180px', padding: '12px', borderRadius: '8px',
                border: `1px solid ${colors.border}`, fontSize: '13px', fontFamily: 'monospace', resize: 'vertical',
                boxSizing: 'border-box', backgroundColor: colors.backgroundCard, color: colors.text
              }}
            />

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                onClick={() => { setShowImportModal(false); setImportData(''); setImportType('auto') }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px',
                  border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundCard, color: colors.text, fontWeight: '500', cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={!importData.trim()}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px',
                  border: 'none', backgroundColor: '#22c55e', color: 'white',
                  fontWeight: '500', cursor: importData.trim() ? 'pointer' : 'not-allowed',
                  opacity: importData.trim() ? 1 : 0.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <Upload size={18} />
                Importar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Reports
