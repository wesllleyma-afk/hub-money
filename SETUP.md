# Como configurar e publicar o Gestor de Empréstimos

## 1. Criar a planilha e as credenciais do Google (uma vez só)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) e crie um projeto
   novo (ex: "gestor-emprestimos").
2. No menu, vá em **APIs e serviços → Biblioteca**, procure por **Google Sheets API** e
   clique em **Ativar**.
3. Vá em **APIs e serviços → Credenciais → Criar credenciais → Conta de serviço**.
   - Dê um nome (ex: "gestor-emprestimos-app") e clique em Concluir (não precisa dar
     nenhuma permissão especial de projeto).
4. Na lista de contas de serviço, clique na que você criou → aba **Chaves** → **Adicionar
   chave → Criar nova chave → JSON**. Um arquivo `.json` será baixado — guarde-o, ele não
   pode ser baixado de novo depois.
5. Abra esse arquivo `.json`. Você vai precisar de dois campos dele:
   - `client_email` → é o e-mail da conta de serviço.
   - `private_key` → é uma chave grande que começa com `-----BEGIN PRIVATE KEY-----`.
6. Crie uma planilha nova em [sheets.google.com](https://sheets.google.com), dê um nome
   (ex: "Dados Gestor Empréstimos").
7. Clique em **Compartilhar** nessa planilha e adicione o `client_email` do passo 5 como
   **Editor**.
8. Copie o **ID da planilha**: é o trecho da URL entre `/d/` e `/edit`.
   Ex: `https://docs.google.com/spreadsheets/d/ESTE_TRECHO_AQUI/edit`

## 2. Rodar no seu computador (para testar)

1. Instale o [Node.js](https://nodejs.org) (versão 18 ou mais recente).
2. Copie o arquivo `.env.example` para `.env` e preencha:
   - `SPREADSHEET_ID`: o ID copiado no passo 1.8.
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: o `client_email` do passo 1.5.
   - `GOOGLE_PRIVATE_KEY`: o `private_key` do passo 1.5 (cole entre aspas, mantendo os
     `\n`).
   - `JWT_SECRET`: qualquer texto longo e aleatório.
3. No terminal, dentro da pasta `gestor-emprestimos`, rode:
   ```bash
   npm install
   npm start
   ```
4. Abra `http://localhost:3000` no navegador. Na primeira vez, ele vai pedir para criar a
   conta de administrador.

## 3. Publicar na internet (Render.com)

1. Crie uma conta gratuita em [render.com](https://render.com).
2. Suba este projeto para um repositório no GitHub (peça ajuda se precisar).
3. No painel do Render, clique em **New → Web Service**, conecte o repositório do GitHub.
4. O Render vai detectar o `render.yaml` automaticamente. Configure as variáveis de
   ambiente pedidas (`SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
   `GOOGLE_PRIVATE_KEY`) com os mesmos valores do passo 2.
5. Clique em **Deploy**. Depois de alguns minutos, o Render dá um endereço
   `https://gestor-emprestimos.onrender.com` (ou parecido) — esse é o link do seu site.
6. Acesse o link e crie a conta de administrador na primeira vez.

## 4. Criando login para funcionários

Depois de logado como administrador, vá em **Usuários → Novo usuário** no menu do site.
Cada funcionário vai enxergar apenas os clientes e empréstimos que ele mesmo cadastrar.
