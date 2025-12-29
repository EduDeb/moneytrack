/**
 * Helper para operações com valores monetários
 * Evita problemas de precisão de ponto flutuante em JavaScript
 */

/**
 * Arredonda um valor para 2 casas decimais (padrão monetário)
 * @param {number} value - Valor a ser arredondado
 * @returns {number} - Valor arredondado
 */
function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Soma segura de valores monetários
 * @param  {...number} values - Valores a serem somados
 * @returns {number} - Soma arredondada
 */
function sumMoney(...values) {
  const sum = values.reduce((acc, val) => acc + (val || 0), 0);
  return roundMoney(sum);
}

/**
 * Subtrai valores monetários de forma segura
 * @param {number} value - Valor inicial
 * @param  {...number} subtractions - Valores a serem subtraídos
 * @returns {number} - Resultado arredondado
 */
function subtractMoney(value, ...subtractions) {
  const result = subtractions.reduce((acc, val) => acc - (val || 0), value || 0);
  return roundMoney(result);
}

/**
 * Multiplica um valor monetário de forma segura
 * @param {number} value - Valor a ser multiplicado
 * @param {number} multiplier - Multiplicador
 * @returns {number} - Resultado arredondado
 */
function multiplyMoney(value, multiplier) {
  return roundMoney((value || 0) * (multiplier || 0));
}

/**
 * Reduz um array somando os valores de uma propriedade
 * @param {Array} items - Array de objetos
 * @param {string} property - Nome da propriedade a somar
 * @returns {number} - Soma arredondada
 */
function sumProperty(items, property) {
  const sum = items.reduce((acc, item) => acc + (item[property] || 0), 0);
  return roundMoney(sum);
}

module.exports = {
  roundMoney,
  sumMoney,
  subtractMoney,
  multiplyMoney,
  sumProperty
};
