/**
 * Mapeamento de palavras-chave para categorias
 * Baseado nas transações de Dezembro/2025
 *
 * Formato: { palavraChave: { category: 'Categoria', type: 'expense'|'income' } }
 *
 * A busca é feita em ordem de prioridade:
 * 1. Mapeamento fixo (este arquivo)
 * 2. Histórico de transações do usuário
 */

const categoryMappings = {
  // ============ RECEITAS (income) ============
  'salario': { category: 'Salário', type: 'income' },
  'salário': { category: 'Salário', type: 'income' },
  'freelance': { category: 'Freelance', type: 'income' },
  'investimento': { category: 'Investimentos', type: 'income' },
  'rendimento': { category: 'Investimentos', type: 'income' },
  'dividendo': { category: 'Investimentos', type: 'income' },
  'presente': { category: 'Presente', type: 'income' },

  // ============ DESPESAS (expense) ============

  // --- Colaboradores ---
  'salario gil': { category: 'Colaboradores', type: 'expense' },
  'salario ju': { category: 'Colaboradores', type: 'expense' },
  'salario beth': { category: 'Colaboradores', type: 'expense' },
  'salario vitor': { category: 'Colaboradores', type: 'expense' },
  'uber beth': { category: 'Colaboradores', type: 'expense' },
  'uber gil': { category: 'Colaboradores', type: 'expense' },
  'fgts': { category: 'Colaboradores', type: 'expense' },

  // --- Moradia ---
  'condominio': { category: 'Moradia', type: 'expense' },
  'condomínio': { category: 'Moradia', type: 'expense' },
  'taxa extra': { category: 'Moradia', type: 'expense' },
  'enel': { category: 'Moradia', type: 'expense' },
  'energia': { category: 'Moradia', type: 'expense' },
  'luz': { category: 'Moradia', type: 'expense' },
  'gas': { category: 'Moradia', type: 'expense' },
  'gás': { category: 'Moradia', type: 'expense' },
  'aluguel': { category: 'Moradia', type: 'expense' },
  'iptu': { category: 'Moradia', type: 'expense' },
  'vivo móvel': { category: 'Moradia', type: 'expense' },

  // --- Supermercado / Alimentação ---
  'mercadao': { category: 'Supermercado', type: 'expense' },
  'mercadão': { category: 'Supermercado', type: 'expense' },
  'mercado': { category: 'Supermercado', type: 'expense' },
  'supermercado': { category: 'Supermercado', type: 'expense' },
  'açougue': { category: 'Supermercado', type: 'expense' },
  'acougue': { category: 'Supermercado', type: 'expense' },
  'agua': { category: 'Supermercado', type: 'expense' },
  'água': { category: 'Supermercado', type: 'expense' },
  'aguas': { category: 'Supermercado', type: 'expense' },
  'padaria': { category: 'Supermercado', type: 'expense' },
  'hortifruti': { category: 'Supermercado', type: 'expense' },
  'feira': { category: 'Supermercado', type: 'expense' },

  // --- Saúde ---
  'camed': { category: 'Saúde', type: 'expense' },
  'uniodonto': { category: 'Saúde', type: 'expense' },
  'personal': { category: 'Saúde', type: 'expense' },
  'academia': { category: 'Saúde', type: 'expense' },
  'farmacia': { category: 'Saúde', type: 'expense' },
  'farmácia': { category: 'Saúde', type: 'expense' },
  'medico': { category: 'Saúde', type: 'expense' },
  'médico': { category: 'Saúde', type: 'expense' },
  'consulta': { category: 'Saúde', type: 'expense' },
  'exame': { category: 'Saúde', type: 'expense' },
  'dentista': { category: 'Saúde', type: 'expense' },
  'plano de saude': { category: 'Saúde', type: 'expense' },
  'plano de saúde': { category: 'Saúde', type: 'expense' },

  // --- Educação ---
  'fies': { category: 'Educação', type: 'expense' },
  'ingles': { category: 'Educação', type: 'expense' },
  'inglês': { category: 'Educação', type: 'expense' },
  'curso': { category: 'Educação', type: 'expense' },
  'escola': { category: 'Educação', type: 'expense' },
  'faculdade': { category: 'Educação', type: 'expense' },
  'mensalidade': { category: 'Educação', type: 'expense' },

  // --- Bernardo ---
  'bernardo': { category: 'Bernardo', type: 'expense' },
  'colegio bernardo': { category: 'Bernardo', type: 'expense' },
  'colégio bernardo': { category: 'Bernardo', type: 'expense' },
  'futebol': { category: 'Bernardo', type: 'expense' },

  // --- Carro / Veículos ---
  'carro': { category: 'Carro', type: 'expense' },
  'parcela carro': { category: 'Carro', type: 'expense' },
  'blindagem': { category: 'Carro', type: 'expense' },
  'ipva': { category: 'Carro', type: 'expense' },
  'licenciamento': { category: 'Carro', type: 'expense' },
  'seguro carro': { category: 'Carro', type: 'expense' },
  'mecanico': { category: 'Carro', type: 'expense' },
  'mecânico': { category: 'Carro', type: 'expense' },
  'oficina': { category: 'Carro', type: 'expense' },
  'pneu': { category: 'Carro', type: 'expense' },
  'revisao': { category: 'Carro', type: 'expense' },
  'revisão': { category: 'Carro', type: 'expense' },

  // --- Transporte ---
  'gasolina': { category: 'Transporte', type: 'expense' },
  'combustivel': { category: 'Transporte', type: 'expense' },
  'combustível': { category: 'Transporte', type: 'expense' },
  'uber': { category: 'Transporte', type: 'expense' },
  '99': { category: 'Transporte', type: 'expense' },
  'estacionamento': { category: 'Transporte', type: 'expense' },
  'pedagio': { category: 'Transporte', type: 'expense' },
  'pedágio': { category: 'Transporte', type: 'expense' },

  // --- Manutenção ---
  'manutencao': { category: 'Manutenção Casa', type: 'expense' },
  'manutenção': { category: 'Manutenção Casa', type: 'expense' },
  'elevador': { category: 'Manutenção Casa', type: 'expense' },
  'lago': { category: 'Manutenção Casa', type: 'expense' },
  'eletrica': { category: 'Manutenção Casa', type: 'expense' },
  'elétrica': { category: 'Manutenção Casa', type: 'expense' },
  'encanador': { category: 'Manutenção Casa', type: 'expense' },
  'pintura': { category: 'Manutenção Casa', type: 'expense' },
  'reforma': { category: 'Manutenção Casa', type: 'expense' },

  // --- Assinaturas ---
  'texnet': { category: 'Assinaturas', type: 'expense' },
  'internet': { category: 'Assinaturas', type: 'expense' },
  'vivo celular': { category: 'Assinaturas', type: 'expense' },
  'netflix': { category: 'Assinaturas', type: 'expense' },
  'spotify': { category: 'Assinaturas', type: 'expense' },
  'amazon prime': { category: 'Assinaturas', type: 'expense' },
  'hbo': { category: 'Assinaturas', type: 'expense' },
  'disney': { category: 'Assinaturas', type: 'expense' },
  'globoplay': { category: 'Assinaturas', type: 'expense' },
  'youtube': { category: 'Assinaturas', type: 'expense' },
  'icloud': { category: 'Assinaturas', type: 'expense' },

  // --- Lazer ---
  'tiro': { category: 'Lazer', type: 'expense' },
  'clube': { category: 'Lazer', type: 'expense' },
  'cinema': { category: 'Lazer', type: 'expense' },
  'teatro': { category: 'Lazer', type: 'expense' },
  'show': { category: 'Lazer', type: 'expense' },
  'viagem': { category: 'Lazer', type: 'expense' },
  'hotel': { category: 'Lazer', type: 'expense' },
  'restaurante': { category: 'Lazer', type: 'expense' },
  'bar': { category: 'Lazer', type: 'expense' },
  'delivery': { category: 'Lazer', type: 'expense' },
  'ifood': { category: 'Lazer', type: 'expense' },

  // --- Contas / Cartão ---
  'cartao': { category: 'Contas', type: 'expense' },
  'cartão': { category: 'Contas', type: 'expense' },
  'itau': { category: 'Contas', type: 'expense' },
  'itaú': { category: 'Contas', type: 'expense' },
  'nubank': { category: 'Contas', type: 'expense' },
  'bradesco': { category: 'Contas', type: 'expense' },
  'santander': { category: 'Contas', type: 'expense' },
  'fatura': { category: 'Contas', type: 'expense' },

  // --- Terrenos ---
  'taiba': { category: 'Terrenos', type: 'expense' },
  'terreno': { category: 'Terrenos', type: 'expense' },
  'lote': { category: 'Terrenos', type: 'expense' },

  // --- Impostos ---
  'receita federal': { category: 'Imposto', type: 'expense' },
  'imposto': { category: 'Imposto', type: 'expense' },
  'tributo': { category: 'Imposto', type: 'expense' },
  'darf': { category: 'Imposto', type: 'expense' },
  'irpf': { category: 'Imposto', type: 'expense' },

  // --- Pets ---
  'pet': { category: 'Pets', type: 'expense' },
  'cachorro': { category: 'Pets', type: 'expense' },
  'gato': { category: 'Pets', type: 'expense' },
  'veterinario': { category: 'Pets', type: 'expense' },
  'veterinário': { category: 'Pets', type: 'expense' },
  'racao': { category: 'Pets', type: 'expense' },
  'ração': { category: 'Pets', type: 'expense' },

  // --- Empréstimos ---
  'emprestimo': { category: 'Emprestimos', type: 'expense' },
  'empréstimo': { category: 'Emprestimos', type: 'expense' },
  'financiamento': { category: 'Emprestimos', type: 'expense' },

  // --- Outros ---
  'ajuda mae': { category: 'Outros', type: 'expense' },
  'ajuda mãe': { category: 'Outros', type: 'expense' },
};

/**
 * Busca a categoria mapeada para uma descrição
 * @param {string} description - Descrição da transação
 * @returns {object|null} - { category, type } ou null se não encontrar
 */
function findMappedCategory(description) {
  if (!description) return null;

  const normalizedDesc = description.toLowerCase().trim();

  // 1. Busca exata primeiro
  if (categoryMappings[normalizedDesc]) {
    return { ...categoryMappings[normalizedDesc], confidence: 100, matchType: 'mapping_exact' };
  }

  // 2. Busca por palavras-chave (do maior para menor para pegar matches mais específicos)
  const sortedKeys = Object.keys(categoryMappings).sort((a, b) => b.length - a.length);

  for (const keyword of sortedKeys) {
    if (normalizedDesc.includes(keyword)) {
      return { ...categoryMappings[keyword], confidence: 90, matchType: 'mapping_partial' };
    }
  }

  return null;
}

module.exports = { categoryMappings, findMappedCategory };
