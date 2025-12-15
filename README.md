# Finance App - Aplicativo Financeiro Completo

Aplicativo de controle financeiro pessoal com:
- Controle de receitas e despesas
- Gestão de carteira de investimentos
- Acompanhamento de dívidas e financiamentos
- Dashboard com gráficos e relatórios

## Tecnologias

**Backend:**
- Node.js + Express
- MongoDB + Mongoose
- JWT para autenticação
- bcryptjs para criptografia

**Frontend:**
- React 19
- Vite
- TailwindCSS
- Recharts (gráficos)
- React Router
- Axios

## Pré-requisitos

- Node.js 18+
- MongoDB (local ou Docker)
- npm ou yarn

## Instalação

### 1. Iniciar o MongoDB

Com Docker:
```bash
docker-compose up -d
```

Ou use uma instância local/Atlas do MongoDB.

### 2. Configurar o Backend

```bash
cd backend
npm install
```

Edite o arquivo `.env` se necessário:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/finance-app
JWT_SECRET=sua_chave_secreta_aqui_mude_em_producao
JWT_EXPIRE=7d
```

### 3. Configurar o Frontend

```bash
cd frontend
npm install
```

## Executar a Aplicação

### Backend (Terminal 1)
```bash
cd backend
npm run dev
```
O servidor estará em http://localhost:5000

### Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```
A aplicação estará em http://localhost:5173

## Funcionalidades

### Dashboard
- Visão geral das finanças
- Receitas e despesas do mês
- Patrimônio total
- Gráficos de categorias

### Transações
- Registrar receitas e despesas
- Categorização automática
- Filtros por tipo e categoria
- Edição e exclusão

### Investimentos
- Cadastrar ações, FIIs, cripto, renda fixa
- Acompanhar preço médio e atual
- Ver lucro/prejuízo por ativo
- Resumo da carteira

### Dívidas
- Cadastrar empréstimos e financiamentos
- Registrar pagamentos de parcelas
- Acompanhar progresso de quitação
- Ver total de parcelas mensais

## API Endpoints

### Autenticação
- `POST /api/auth/register` - Cadastrar usuário
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Dados do usuário

### Transações
- `GET /api/transactions` - Listar transações
- `GET /api/transactions/summary` - Resumo mensal
- `POST /api/transactions` - Criar transação
- `PUT /api/transactions/:id` - Atualizar
- `DELETE /api/transactions/:id` - Excluir

### Investimentos
- `GET /api/investments` - Listar investimentos
- `GET /api/investments/summary` - Resumo da carteira
- `POST /api/investments` - Adicionar investimento
- `PUT /api/investments/:id` - Atualizar
- `DELETE /api/investments/:id` - Remover

### Dívidas
- `GET /api/debts` - Listar dívidas
- `GET /api/debts/summary` - Resumo das dívidas
- `POST /api/debts` - Adicionar dívida
- `PUT /api/debts/:id` - Atualizar
- `POST /api/debts/:id/payment` - Registrar pagamento
- `DELETE /api/debts/:id` - Remover

## Estrutura do Projeto

```
finance-app/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Transaction.js
│   │   │   ├── Investment.js
│   │   │   └── Debt.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── transactions.js
│   │   │   ├── investments.js
│   │   │   └── debts.js
│   │   └── server.js
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Transactions.jsx
│   │   │   ├── Investments.jsx
│   │   │   └── Debts.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── docker-compose.yml
```

## Licença

MIT
