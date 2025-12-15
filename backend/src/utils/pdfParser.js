const pdfParse = require('pdf-parse')

// Mapeamento de palavras-chave para categorias de contas
const categoryKeywords = {
  moradia: [
    'aluguel', 'condomínio', 'condominio', 'iptu', 'imobiliária', 'imobiliaria',
    'apartamento', 'casa', 'moradia', 'habitação', 'habitacao'
  ],
  energia: [
    'energia', 'eletric', 'luz', 'cpfl', 'enel', 'cemig', 'copel', 'celesc',
    'coelba', 'light', 'elektro', 'energisa', 'celpe', 'cosern', 'equatorial'
  ],
  agua: [
    'água', 'agua', 'sabesp', 'saneago', 'caesb', 'copasa', 'cagece', 'caern',
    'corsan', 'saneamento', 'hidrica', 'hídrica', 'compesa', 'dae', 'sanasa'
  ],
  internet: [
    'internet', 'wifi', 'wi-fi', 'fibra', 'banda larga', 'net', 'vivo fibra',
    'claro internet', 'oi fibra', 'tim live', 'gvt', 'provider'
  ],
  telefone: [
    'telefone', 'telefonia', 'celular', 'móvel', 'movel', 'vivo', 'claro',
    'tim', 'oi', 'algar', 'nextel', 'porto', 'operadora'
  ],
  streaming: [
    'netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'star+', 'globoplay',
    'apple tv', 'youtube premium', 'deezer', 'paramount', 'streaming', 'crunchyroll',
    'amazon music', 'apple music'
  ],
  seguro: [
    'seguro', 'seguros', 'porto seguro', 'bradesco seguro', 'mapfre', 'sulamerica',
    'sul américa', 'sul america', 'unimed', 'plano de saúde', 'plano de saude',
    'dental', 'odontológico', 'odontologico', 'vida', 'auto', 'residencial'
  ],
  cartao: [
    'cartão', 'cartao', 'fatura', 'nubank', 'itaucard', 'bradescard', 'elo',
    'mastercard', 'visa', 'hipercard', 'american express', 'amex', 'inter',
    'c6 bank', 'santander', 'banco do brasil', 'caixa'
  ],
  emprestimo: [
    'empréstimo', 'emprestimo', 'financiamento', 'parcela', 'consórcio', 'consorcio',
    'crédito', 'credito', 'dívida', 'divida', 'prestação', 'prestacao', 'crediário'
  ]
}

// Padrões de expressões regulares para extrair informações
const patterns = {
  // Valores monetários (R$ 123,45 ou R$123.45 ou 123,45 ou 1.234,56)
  amount: /R?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/gi,

  // Datas (dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, dd/mm)
  date: /(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/gi,

  // Vencimento com contexto
  dueDate: /(?:venc(?:imento)?|vence|pag(?:ar|amento)?|data)[:\s]*(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/gi,

  // Dia do vencimento isolado
  dueDay: /(?:dia|venc(?:imento)?)[:\s]*(\d{1,2})/gi
}

/**
 * Identifica a categoria baseada no texto
 */
function identifyCategory(text) {
  const lowerText = text.toLowerCase()

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return category
      }
    }
  }

  return 'outros'
}

/**
 * Extrai valores monetários do texto
 */
function extractAmounts(text) {
  const amounts = []
  const matches = text.matchAll(patterns.amount)

  for (const match of matches) {
    let value = match[1]
    // Converter formato brasileiro para número
    value = value.replace(/\./g, '').replace(',', '.')
    const numValue = parseFloat(value)

    if (numValue > 0 && numValue < 100000) { // Limites razoáveis
      amounts.push(numValue)
    }
  }

  return amounts
}

/**
 * Extrai datas de vencimento do texto
 */
function extractDueDate(text) {
  // Primeiro, tenta encontrar datas com contexto de vencimento
  const dueDateMatch = patterns.dueDate.exec(text)
  if (dueDateMatch) {
    return {
      day: parseInt(dueDateMatch[1]),
      month: parseInt(dueDateMatch[2]),
      year: dueDateMatch[3] ? parseInt(dueDateMatch[3]) : new Date().getFullYear()
    }
  }

  // Tenta encontrar dia de vencimento isolado
  const dueDayMatch = patterns.dueDay.exec(text)
  if (dueDayMatch) {
    return {
      day: parseInt(dueDayMatch[1]),
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear()
    }
  }

  // Procura por todas as datas e retorna a mais provável (primeira encontrada)
  const dateMatch = patterns.date.exec(text)
  if (dateMatch) {
    const day = parseInt(dateMatch[1])
    const month = parseInt(dateMatch[2])
    // Se dia for maior que 31, provavelmente está invertido
    if (day <= 31 && month <= 12) {
      return {
        day,
        month,
        year: dateMatch[3] ? parseInt(dateMatch[3]) : new Date().getFullYear()
      }
    }
  }

  return null
}

/**
 * Divide o texto em blocos que podem representar contas individuais
 */
function splitIntoBlocks(text) {
  // Remove linhas em branco excessivas e normaliza
  const normalized = text.replace(/\n{3,}/g, '\n\n')

  // Tenta dividir por padrões comuns de separação
  const blocks = []

  // Tenta identificar padrões de lista de contas
  // Padrão 1: Linhas que começam com números ou bullets
  const lines = normalized.split('\n')
  let currentBlock = []

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join(' '))
        currentBlock = []
      }
      continue
    }

    // Se a linha parece ser início de novo item (número, bullet, ou começa com letra maiúscula após espaço)
    const isNewItem = /^(\d+[\.\)\-]|\-|\•|\*|[A-Z])/.test(trimmedLine)

    if (isNewItem && currentBlock.length > 0) {
      blocks.push(currentBlock.join(' '))
      currentBlock = [trimmedLine]
    } else {
      currentBlock.push(trimmedLine)
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join(' '))
  }

  // Se não conseguiu dividir bem, tenta por valores monetários
  if (blocks.length <= 1) {
    const byAmount = normalized.split(/(?=R?\$\s*\d)/gi)
    if (byAmount.length > 1) {
      return byAmount.filter(b => b.trim())
    }
  }

  return blocks.filter(b => b.trim())
}

/**
 * Extrai nome da conta do bloco de texto
 */
function extractBillName(text, category) {
  // Remove valores e datas para pegar o nome mais limpo
  let cleanText = text
    .replace(/R?\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?/gi, '')
    .replace(/\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?/gi, '')
    .replace(/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Se sobrou texto, usa como nome
  if (cleanText.length > 2 && cleanText.length < 100) {
    // Capitaliza primeira letra de cada palavra
    return cleanText
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .substring(0, 100)
  }

  // Fallback: usa categoria como base do nome
  const categoryLabels = {
    moradia: 'Moradia',
    energia: 'Conta de Energia',
    agua: 'Conta de Água',
    internet: 'Internet',
    telefone: 'Telefone',
    streaming: 'Streaming',
    seguro: 'Seguro',
    cartao: 'Cartão de Crédito',
    emprestimo: 'Empréstimo',
    outros: 'Conta'
  }

  return categoryLabels[category] || 'Conta'
}

/**
 * Analisa um bloco de texto e extrai informações da conta
 */
function parseBlock(text) {
  const category = identifyCategory(text)
  const amounts = extractAmounts(text)
  const dueDate = extractDueDate(text)
  const name = extractBillName(text, category)

  // Seleciona o valor mais provável (geralmente o maior que parece valor de conta)
  let amount = 0
  if (amounts.length > 0) {
    // Filtra valores muito pequenos (provavelmente não são valores de conta)
    const validAmounts = amounts.filter(a => a >= 10)
    // Pega o maior valor (geralmente é o total da conta)
    amount = validAmounts.length > 0 ? Math.max(...validAmounts) : amounts[0]
  }

  return {
    name,
    category,
    amount,
    dueDay: dueDate ? dueDate.day : null,
    dueMonth: dueDate ? dueDate.month : null,
    dueYear: dueDate ? dueDate.year : null,
    rawText: text.substring(0, 200),
    confidence: calculateConfidence(name, amount, dueDate)
  }
}

/**
 * Calcula nível de confiança da extração
 */
function calculateConfidence(name, amount, dueDate) {
  let score = 0

  if (name && name.length > 3) score += 30
  if (amount > 0) score += 40
  if (dueDate && dueDate.day >= 1 && dueDate.day <= 31) score += 30

  return score
}

/**
 * Processa um arquivo PDF e extrai contas
 */
async function parsePDF(buffer) {
  try {
    const data = await pdfParse(buffer)
    const text = data.text

    console.log('[PDF Parser] Texto extraído:', text.substring(0, 500))

    // Divide em blocos
    const blocks = splitIntoBlocks(text)

    console.log(`[PDF Parser] ${blocks.length} blocos encontrados`)

    // Processa cada bloco
    const bills = []

    for (const block of blocks) {
      if (block.length < 5) continue // Ignora blocos muito pequenos

      const bill = parseBlock(block)

      // Só adiciona se tiver informações mínimas
      if (bill.amount > 0 || bill.confidence >= 30) {
        bills.push(bill)
      }
    }

    // Remove duplicatas baseado em nome similar e valor
    const uniqueBills = removeDuplicates(bills)

    console.log(`[PDF Parser] ${uniqueBills.length} contas extraídas`)

    return {
      success: true,
      bills: uniqueBills,
      totalPages: data.numpages,
      rawTextPreview: text.substring(0, 1000)
    }
  } catch (error) {
    console.error('[PDF Parser] Erro:', error)
    return {
      success: false,
      error: error.message,
      bills: []
    }
  }
}

/**
 * Remove contas duplicadas
 */
function removeDuplicates(bills) {
  const seen = new Map()

  return bills.filter(bill => {
    const key = `${bill.name.toLowerCase()}-${bill.amount}`
    if (seen.has(key)) {
      return false
    }
    seen.set(key, true)
    return true
  })
}

/**
 * Processa texto simples (para importação via textarea)
 */
function parseText(text) {
  const blocks = splitIntoBlocks(text)
  const bills = []

  for (const block of blocks) {
    if (block.length < 5) continue

    const bill = parseBlock(block)

    if (bill.amount > 0 || bill.confidence >= 30) {
      bills.push(bill)
    }
  }

  return {
    success: true,
    bills: removeDuplicates(bills)
  }
}

module.exports = {
  parsePDF,
  parseText,
  identifyCategory,
  extractAmounts,
  extractDueDate
}
