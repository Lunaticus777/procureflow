# ProcureFlow — Guia de Instalação

## O que precisas
- Conta GitHub (gratuita) → github.com
- Conta Supabase (gratuita) → supabase.com
- Conta Vercel (gratuita) → vercel.com
- Node.js instalado → nodejs.org (versão 18+)

---

## Passo 1 — Criar a base de dados no Supabase

1. Vai a **supabase.com** → "Start your project" → cria conta
2. "New Project" → dá um nome (ex: `procureflow`) → escolhe região **West EU (Ireland)**
3. Aguarda ~2 min até o projeto estar pronto
4. No menu lateral, vai a **SQL Editor** → "New query"
5. Abre o ficheiro `supabase_schema.sql` deste projeto, copia TODO o conteúdo e cola no editor
6. Clica **Run** — deve aparecer "Success"
7. No menu lateral, vai a **Settings → API**
8. Copia:
   - **Project URL** (começa com `https://`)
   - **anon public key** (começa com `eyJ`)

---

## Passo 2 — Criar utilizadores no Supabase

1. No Supabase, vai a **Authentication → Users → Add user**
2. Cria um utilizador para cada pessoa da equipa (email + password)
3. Guarda os emails e passwords para distribuir à equipa

---

## Passo 3 — Configurar o projeto localmente

Abre o terminal (VS Code → Terminal → New Terminal) na pasta do projeto:

```bash
# Instalar dependências
npm install

# Copiar ficheiro de configuração
cp .env.example .env
```

Abre o ficheiro `.env` e preenche:
```
VITE_SUPABASE_URL=https://XXXXX.supabase.co      ← a tua URL
VITE_SUPABASE_ANON_KEY=eyJhbGci...               ← a tua chave
```

Testa localmente:
```bash
npm run dev
```
Abre o browser em **http://localhost:5173** e faz login com um utilizador que criaste.

---

## Passo 4 — Publicar no Vercel (URL pública para a equipa)

### Opção A — Via GitHub (recomendado)

1. Cria uma conta em **github.com**
2. Cria um novo repositório (ex: `procureflow`)
3. No terminal, dentro da pasta do projeto:
```bash
git init
git add .
git commit -m "primeiro commit"
git remote add origin https://github.com/TEN_UTILIZADOR/procureflow.git
git push -u origin main
```
4. Vai a **vercel.com** → "New Project" → liga a conta GitHub → seleciona o repositório
5. Em **Environment Variables**, adiciona:
   - `VITE_SUPABASE_URL` = a tua URL
   - `VITE_SUPABASE_ANON_KEY` = a tua chave
6. Clica **Deploy**
7. Em ~2 minutos tens um URL público tipo `procureflow-xxx.vercel.app`

### Opção B — Via Vercel CLI
```bash
npm install -g vercel
vercel
# Segue as instruções, adiciona as variáveis quando pedido
```

---

## Acesso da equipa

- Partilha o URL do Vercel com a equipa
- Cada pessoa entra com o email e password que criaste no Supabase
- Funciona em qualquer browser, computador ou telemóvel

---

## Estrutura do projeto

```
procureflow/
├── src/
│   ├── pages/
│   │   ├── Dashboard.jsx      ← visão geral
│   │   ├── Requisitions.jsx   ← criar pedidos de material
│   │   ├── Quotations.jsx     ← introduzir cotações de fornecedores
│   │   ├── Orders.jsx         ← seguimento de encomendas
│   │   ├── Payments.jsx       ← controlo de faturas
│   │   ├── Transport.jsx      ← gestão de transportadores
│   │   ├── Suppliers.jsx      ← avaliação de fornecedores
│   │   └── Stock.jsx          ← alertas de stock mínimo
│   ├── hooks/useAuth.jsx      ← autenticação
│   ├── lib/supabase.js        ← ligação à base de dados
│   ├── App.jsx                ← navegação principal
│   └── index.css              ← estilos
├── supabase_schema.sql        ← schema completo da base de dados
├── .env.example               ← template de configuração
└── vercel.json                ← configuração de deploy
```

---

## Suporte

Se tiveres dúvidas durante a instalação, pede ajuda ao Claude com as mensagens de erro exactas.
