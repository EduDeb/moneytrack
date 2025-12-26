/**
 * Helper para manipulação de strings
 */

/**
 * Capitaliza a primeira letra de uma string
 * @param {string} str - String a ser capitalizada
 * @returns {string} String com primeira letra maiúscula
 */
function capitalize(str) {
  if (!str || typeof str !== 'string') return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Capitaliza a primeira letra de cada palavra
 * @param {string} str - String a ser capitalizada
 * @returns {string} String com cada palavra iniciando em maiúscula
 */
function capitalizeWords(str) {
  if (!str || typeof str !== 'string') return str
  return str.split(' ').map(word => capitalize(word)).join(' ')
}

module.exports = {
  capitalize,
  capitalizeWords
}
