const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const {
  runUserAnalysis,
  calculateFinancialHealthScore,
  ALERT_CONFIG
} = require('../services/alertService')

router.use(protect)

// @route   POST /api/alerts/analyze
// @desc    Executar análise e gerar alertas
router.post('/analyze', async (req, res) => {
  try {
    const alerts = await runUserAnalysis(req.user._id)

    res.json({
      message: 'Análise concluída',
      alertsGenerated: alerts.length,
      alerts
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao analisar', error: error.message })
  }
})

// @route   GET /api/alerts/health-score
// @desc    Obter score de saúde financeira
router.get('/health-score', async (req, res) => {
  try {
    const healthScore = await calculateFinancialHealthScore(req.user._id)

    res.json(healthScore)
  } catch (error) {
    res.status(500).json({ message: 'Erro ao calcular score', error: error.message })
  }
})

// @route   GET /api/alerts/config
// @desc    Obter configurações de alertas
router.get('/config', async (req, res) => {
  res.json(ALERT_CONFIG)
})

module.exports = router
