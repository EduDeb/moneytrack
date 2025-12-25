import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 30000, // 30 seconds timeout to prevent hanging requests
  headers: {
    'Content-Type': 'application/json'
  }
})

// Interceptor para adicionar token automaticamente
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Função para aguardar backend estar pronto
const waitForBackend = async (maxRetries = 10, delayMs = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get('http://localhost:3001/api/health', { timeout: 2000 })
      return true
    } catch (e) {
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delayMs))
      }
    }
  }
  return false
}

// Interceptor de resposta com retry para erros de conexão
api.interceptors.response.use(
  response => response,
  async error => {
    const config = error.config

    // Se for erro de conexão (backend não disponível), tentar reconectar
    if (!error.response && !config._retry) {
      config._retry = true

      // Aguardar backend estar disponível
      const isReady = await waitForBackend(5, 1000)
      if (isReady) {
        // Tentar novamente a requisição original
        return api(config)
      }
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
