const express = require('express')
const router = express.Router()
const AuditLog = require('../models/AuditLog')
const { protect } = require('../middleware/auth')

router.use(protect)

// @route   GET /api/audit
// @desc    Listar logs de auditoria do usuário
router.get('/', async (req, res) => {
  try {
    const {
      action,
      resource,
      status,
      severity,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query

    const query = { user: req.user._id }

    if (action) query.action = action
    if (resource) query.resource = resource
    if (status) query.status = status
    if (severity) query.severity = severity

    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) query.timestamp.$gte = new Date(startDate)
      if (endDate) query.timestamp.$lte = new Date(endDate)
    }

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))

    const total = await AuditLog.countDocuments(query)

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar logs', error: error.message })
  }
})

// @route   GET /api/audit/security
// @desc    Listar logs de segurança (high/critical severity)
router.get('/security', async (req, res) => {
  try {
    const { days = 30 } = req.query
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(days))

    const logs = await AuditLog.find({
      user: req.user._id,
      severity: { $in: ['high', 'critical'] },
      timestamp: { $gte: startDate }
    })
      .sort({ timestamp: -1 })
      .limit(100)

    res.json({ logs })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar logs de segurança', error: error.message })
  }
})

// @route   GET /api/audit/logins
// @desc    Histórico de logins
router.get('/logins', async (req, res) => {
  try {
    const { days = 30 } = req.query
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(days))

    const logs = await AuditLog.find({
      user: req.user._id,
      action: { $in: ['LOGIN', 'LOGIN_FAILED', 'LOGOUT'] },
      timestamp: { $gte: startDate }
    })
      .sort({ timestamp: -1 })
      .limit(100)

    // Agrupar por IP
    const ipStats = {}
    logs.forEach(log => {
      const ip = log.request?.ip || 'unknown'
      if (!ipStats[ip]) {
        ipStats[ip] = { success: 0, failed: 0, lastSeen: null }
      }
      if (log.action === 'LOGIN') ipStats[ip].success++
      if (log.action === 'LOGIN_FAILED') ipStats[ip].failed++
      if (!ipStats[ip].lastSeen || log.timestamp > ipStats[ip].lastSeen) {
        ipStats[ip].lastSeen = log.timestamp
      }
    })

    res.json({ logs, ipStats })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar logins', error: error.message })
  }
})

// @route   GET /api/audit/activity
// @desc    Atividades recentes
router.get('/activity', async (req, res) => {
  try {
    const { days = 7 } = req.query
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(days))

    // Logs recentes
    const recentLogs = await AuditLog.find({
      user: req.user._id,
      timestamp: { $gte: startDate }
    })
      .sort({ timestamp: -1 })
      .limit(50)

    // Estatísticas por tipo de ação
    const actionStats = await AuditLog.aggregate([
      {
        $match: {
          user: req.user._id,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ])

    // Atividade por dia
    const dailyActivity = await AuditLog.aggregate([
      {
        $match: {
          user: req.user._id,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])

    res.json({
      recentLogs,
      actionStats,
      dailyActivity
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar atividade', error: error.message })
  }
})

// @route   GET /api/audit/export
// @desc    Exportar logs de auditoria
router.get('/export', async (req, res) => {
  try {
    const { format = 'json', startDate, endDate } = req.query

    const query = { user: req.user._id }

    if (startDate || endDate) {
      query.timestamp = {}
      if (startDate) query.timestamp.$gte = new Date(startDate)
      if (endDate) query.timestamp.$lte = new Date(endDate)
    }

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(10000) // Limite máximo

    // Log da exportação
    await AuditLog.log({
      userId: req.user._id,
      action: 'DATA_EXPORT',
      resource: 'audit',
      details: { format, count: logs.length },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: 'GET',
      path: '/api/audit/export'
    })

    if (format === 'csv') {
      const headers = ['timestamp', 'action', 'resource', 'status', 'severity', 'ip', 'details']
      const csvData = [
        headers.join(','),
        ...logs.map(log => [
          log.timestamp.toISOString(),
          log.action,
          log.resource,
          log.status,
          log.severity,
          log.request?.ip || '',
          JSON.stringify(log.details || {}).replace(/,/g, ';')
        ].join(','))
      ].join('\n')

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv')
      return res.send(csvData)
    }

    res.json({ logs })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao exportar logs', error: error.message })
  }
})

// @route   GET /api/audit/stats
// @desc    Estatísticas de auditoria
router.get('/stats', async (req, res) => {
  try {
    const { days = 30 } = req.query
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(days))

    const [
      totalLogs,
      securityAlerts,
      failedLogins,
      successLogins,
      dataExports
    ] = await Promise.all([
      AuditLog.countDocuments({
        user: req.user._id,
        timestamp: { $gte: startDate }
      }),
      AuditLog.countDocuments({
        user: req.user._id,
        severity: { $in: ['high', 'critical'] },
        timestamp: { $gte: startDate }
      }),
      AuditLog.countDocuments({
        user: req.user._id,
        action: 'LOGIN_FAILED',
        timestamp: { $gte: startDate }
      }),
      AuditLog.countDocuments({
        user: req.user._id,
        action: 'LOGIN',
        timestamp: { $gte: startDate }
      }),
      AuditLog.countDocuments({
        user: req.user._id,
        action: 'DATA_EXPORT',
        timestamp: { $gte: startDate }
      })
    ])

    // Dispositivos únicos (baseado em User-Agent)
    const uniqueDevices = await AuditLog.distinct('request.userAgent', {
      user: req.user._id,
      action: 'LOGIN',
      timestamp: { $gte: startDate }
    })

    // IPs únicos
    const uniqueIPs = await AuditLog.distinct('request.ip', {
      user: req.user._id,
      timestamp: { $gte: startDate }
    })

    res.json({
      period: `${days} dias`,
      stats: {
        totalLogs,
        securityAlerts,
        failedLogins,
        successLogins,
        dataExports,
        uniqueDevices: uniqueDevices.length,
        uniqueIPs: uniqueIPs.length,
        loginSuccessRate: successLogins + failedLogins > 0
          ? ((successLogins / (successLogins + failedLogins)) * 100).toFixed(1) + '%'
          : 'N/A'
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar estatísticas', error: error.message })
  }
})

module.exports = router
