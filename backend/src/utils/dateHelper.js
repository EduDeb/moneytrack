/**
 * Helper para manipulação de datas com timezone UTC
 *
 * O sistema usa UTC internamente para consistência.
 * Este helper garante que datas sejam normalizadas corretamente.
 */

/**
 * Normaliza uma data para o início do dia em UTC, preservando o dia/mês/ano
 * Isso garante que uma transação criada em "2024-12-31" fique em dezembro,
 * independente do timezone do usuário.
 *
 * @param {Date|string} date - Data a ser normalizada
 * @returns {Date} Data normalizada para início do dia em UTC
 */
function normalizeToUTC(date) {
  if (!date) return new Date()

  const d = new Date(date)

  // Se a data veio como string ISO (ex: "2024-12-31T23:59:00.000Z"), usar diretamente
  // Se veio como string local (ex: "2024-12-31"), normalizar para UTC
  if (typeof date === 'string' && !date.includes('T')) {
    // Data sem hora - criar em UTC diretamente
    const [year, month, day] = date.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
  }

  // Se veio como Date ou string com hora, usar os componentes UTC
  return new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    12, 0, 0, 0 // Meio-dia UTC para evitar problemas de edge
  ))
}

/**
 * Cria os limites de um mês para queries
 *
 * @param {number} month - Mês (1-12)
 * @param {number} year - Ano
 * @returns {{ startDate: Date, endDate: Date }} Início e fim do mês em UTC
 */
function getMonthBounds(month, year) {
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  return { startDate, endDate }
}

/**
 * Obtém o mês/ano de uma data em UTC
 *
 * @param {Date} date - Data
 * @returns {{ month: number, year: number }} Mês (1-12) e ano
 */
function getMonthYear(date) {
  const d = new Date(date)
  return {
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear()
  }
}

/**
 * Verifica se uma data está dentro de um mês
 *
 * @param {Date} date - Data a verificar
 * @param {number} month - Mês (1-12)
 * @param {number} year - Ano
 * @returns {boolean} True se a data está no mês
 */
function isInMonth(date, month, year) {
  const d = new Date(date)
  return d.getUTCMonth() + 1 === month && d.getUTCFullYear() === year
}

/**
 * Formata data para exibição (pt-BR)
 *
 * @param {Date} date - Data
 * @returns {string} Data formatada (ex: "31/12/2024")
 */
function formatDateBR(date) {
  const d = new Date(date)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

/**
 * Calcula dias entre duas datas
 *
 * @param {Date} date1 - Primeira data
 * @param {Date} date2 - Segunda data
 * @returns {number} Número de dias (positivo se date2 > date1)
 */
function daysBetween(date1, date2) {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffTime = d2 - d1
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

module.exports = {
  normalizeToUTC,
  getMonthBounds,
  getMonthYear,
  isInMonth,
  formatDateBR,
  daysBetween
}
