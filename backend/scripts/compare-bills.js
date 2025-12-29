// Dados de Julho 2026
const julho = [
  { name: "Ajuda mãe", amount: 800 },
  { name: "Futebol", amount: 335 },
  { name: "Ingles Debora", amount: 368 },
  { name: "Açougue (Sem 1)", amount: 350 },
  { name: "Mercadão (Sem 1)", amount: 550 },
  { name: "Personal Debora e Eduardo", amount: 1500 },
  { name: "Uniodonto", amount: 179 },
  { name: "Texnet ( INTERNET )", amount: 113.9 },
  { name: "Condomínio", amount: 5488 },
  { name: "Carro Debora", amount: 5280 },
  { name: "Condominio Taiba lote 1", amount: 271.92 },
  { name: "Condomínio Taiba lote 2", amount: 271.97 },
  { name: "Açougue (Sem 2)", amount: 350 },
  { name: "Mercadão (Sem 2)", amount: 550 },
  { name: "Salario Gil", amount: 2000 },
  { name: "Salario Ju", amount: 1200 },
  { name: "Salario Vitor", amount: 1200 },
  { name: "Enel Energia", amount: 2500 },
  { name: "Camed", amount: 2750 },
  { name: "Açougue (Sem 3)", amount: 350 },
  { name: "Mercadão (Sem 3)", amount: 550 },
  { name: "Colegio Bernardo", amount: 3047.87 },
  { name: "Manutencao Elevador ( boleto )", amount: 300 },
  { name: "FIES  Debora", amount: 418 },
  { name: "Açougue (Sem 4)", amount: 350 },
  { name: "Mercadão (Sem 4)", amount: 550 },
  { name: "Receita Federal", amount: 1221.71 }
];

// Dados de Agosto 2026
const agosto = [
  { name: "Ajuda mãe", amount: 800 },
  { name: "Açougue (Sem 1)", amount: 350 },
  { name: "Mercadão (Sem 1)", amount: 550 },
  { name: "Futebol", amount: 335 },
  { name: "Ingles Debora", amount: 368 },
  { name: "Uniodonto", amount: 179 },
  { name: "Texnet ( INTERNET )", amount: 113.9 },
  { name: "Condomínio", amount: 5488 },
  { name: "Carro Debora", amount: 5280 },
  { name: "Condominio Taiba lote 1", amount: 271.92 },
  { name: "Condomínio Taiba lote 2", amount: 271.97 },
  { name: "Açougue (Sem 2)", amount: 350 },
  { name: "Mercadão (Sem 2)", amount: 550 },
  { name: "Salario Gil", amount: 2000 },
  { name: "Salario Ju", amount: 1200 },
  { name: "Salario Vitor", amount: 1200 },
  { name: "Enel Energia", amount: 2500 },
  { name: "Açougue (Sem 3)", amount: 350 },
  { name: "Mercadão (Sem 3)", amount: 550 },
  { name: "Camed", amount: 2750 },
  { name: "Manutencao Elevador ( boleto )", amount: 300 },
  { name: "FIES  Debora", amount: 418 },
  { name: "Açougue (Sem 4)", amount: 350 },
  { name: "Mercadão (Sem 4)", amount: 550 },
  { name: "Receita Federal", amount: 1221.71 },
  { name: "Açougue (Sem 5)", amount: 350 },
  { name: "Mercadão (Sem 5)", amount: 550 }
];

// Calcular totais
const totalJulho = julho.reduce((sum, b) => sum + b.amount, 0);
const totalAgosto = agosto.reduce((sum, b) => sum + b.amount, 0);

console.log('=== RESUMO ===');
console.log(`Julho 2026: ${julho.length} contas - Total: R$ ${totalJulho.toFixed(2)}`);
console.log(`Agosto 2026: ${agosto.length} contas - Total: R$ ${totalAgosto.toFixed(2)}`);
console.log(`Diferença: R$ ${(totalAgosto - totalJulho).toFixed(2)}`);

// Criar maps para comparação
const julhoMap = {};
julho.forEach(b => { julhoMap[b.name] = b.amount; });

const agostoMap = {};
agosto.forEach(b => { agostoMap[b.name] = b.amount; });

// Encontrar diferenças
console.log('\n=== DIFERENÇAS ENCONTRADAS ===');
const allNames = new Set([...Object.keys(julhoMap), ...Object.keys(agostoMap)]);

let diffCount = 0;
allNames.forEach(name => {
  const julVal = julhoMap[name] || 0;
  const agoVal = agostoMap[name] || 0;

  if (julVal !== agoVal) {
    diffCount++;
    if (julVal === 0) {
      console.log(`[NOVA EM AGOSTO] ${name}: R$ ${agoVal.toFixed(2)}`);
    } else if (agoVal === 0) {
      console.log(`[SÓ EM JULHO] ${name}: R$ ${julVal.toFixed(2)}`);
    } else {
      const diff = agoVal - julVal;
      console.log(`[DIFERENTE] ${name}: Jul R$ ${julVal.toFixed(2)} → Ago R$ ${agoVal.toFixed(2)} (${diff > 0 ? '+' : ''}R$ ${diff.toFixed(2)})`);
    }
  }
});

if (diffCount === 0) {
  console.log('Nenhuma diferença encontrada!');
}

console.log('\n=== EXPLICAÇÃO ===');
console.log('1. Personal Debora e Eduardo (R$ 1500) - termina em 06/07/2026, não aparece em agosto');
console.log('2. Colegio Bernardo (R$ 3047.87) - termina em 04/07/2026, não aparece em agosto');
console.log('3. Açougue (Sem 5) (R$ 350) - agosto tem 5 semanas, julho só 4');
console.log('4. Mercadão (Sem 5) (R$ 550) - agosto tem 5 semanas, julho só 4');
console.log('\nTotal a menos em agosto: R$ 1500 + R$ 3047.87 = R$ 4547.87');
console.log('Total a mais em agosto: R$ 350 + R$ 550 = R$ 900');
console.log(`Diferença líquida: R$ ${(900 - 4547.87).toFixed(2)} (agosto é menor que julho)`);
