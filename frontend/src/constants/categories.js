// Arquivo centralizado de categorias - edite aqui para atualizar em todo o app

export const incomeCategories = [
  { value: 'salario', label: 'Salário', color: '#22c55e' },
  { value: 'freelance', label: 'Freelance', color: '#10b981' },
  { value: 'investimentos', label: 'Investimentos', color: '#14b8a6' },
  { value: 'vendas', label: 'Vendas', color: '#06b6d4' },
  { value: 'aluguel_recebido', label: 'Aluguel Recebido', color: '#0ea5e9' },
  { value: 'outros_receita', label: 'Outros', color: '#84cc16' }
]

export const expenseCategories = [
  { value: 'alimentacao', label: 'Alimentação', color: '#f97316' },
  { value: 'colaboradores', label: 'Colaboradores', color: '#3b82f6' },
  { value: 'moradia', label: 'Moradia', color: '#8b5cf6' },
  { value: 'saude', label: 'Saúde', color: '#ef4444' },
  { value: 'educacao', label: 'Educação', color: '#06b6d4' },
  { value: 'lazer', label: 'Lazer', color: '#ec4899' },
  { value: 'compras', label: 'Compras', color: '#f59e0b' },
  { value: 'contas', label: 'Contas', color: '#64748b' },
  { value: 'assinaturas', label: 'Assinaturas', color: '#a855f7' },
  { value: 'vestuario', label: 'Vestuário', color: '#d946ef' },
  { value: 'pets', label: 'Pets', color: '#f472b6' },
  { value: 'outros_despesa', label: 'Outros', color: '#6b7280' }
]

// Objeto para uso em Transactions.jsx
export const categories = {
  income: incomeCategories,
  expense: expenseCategories
}

// Array completo para uso em Budget.jsx e outros
export const allExpenseCategories = expenseCategories

// Mapa de labels por value
export const categoryLabels = Object.fromEntries(
  [...incomeCategories, ...expenseCategories].map(c => [c.value, c.label])
)

// Mapa completo por value (com cor)
export const categoryMap = Object.fromEntries(
  [...incomeCategories, ...expenseCategories].map(c => [c.value, c])
)

// Função para obter cor de uma categoria
export const getCategoryColor = (value) => {
  const cat = categoryMap[value]
  return cat?.color || '#6b7280'
}

// Função para obter label de uma categoria
export const getCategoryLabel = (value) => {
  return categoryLabels[value] || billCategoryLabels[value] || value
}

// Categorias específicas para Contas a Pagar (Bills)
export const billCategories = [
  { value: 'moradia', label: 'Moradia', color: '#8b5cf6' },
  { value: 'energia', label: 'Energia', color: '#f59e0b' },
  { value: 'agua', label: 'Água', color: '#3b82f6' },
  { value: 'internet', label: 'Internet', color: '#06b6d4' },
  { value: 'telefone', label: 'Telefone', color: '#10b981' },
  { value: 'streaming', label: 'Streaming', color: '#ec4899' },
  { value: 'seguro', label: 'Seguro', color: '#6366f1' },
  { value: 'cartao', label: 'Cartão', color: '#ef4444' },
  { value: 'emprestimo', label: 'Empréstimo', color: '#f97316' },
  { value: 'outros', label: 'Outros', color: '#6b7280' }
]

export const billCategoryLabels = Object.fromEntries(
  billCategories.map(c => [c.value, c.label])
)
