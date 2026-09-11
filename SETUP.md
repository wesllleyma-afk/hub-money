# Como configurar e publicar o Gestor de Empréstimos

## 1. Criar o banco de dados (Neon, gratuito)

1. Acesse [neon.tech](https://neon.tech) e crie uma conta gratuita (dá para entrar com o
   Google).
2. Crie um novo projeto (ex: "gestor-emprestimos").
3. Na tela do projeto, procure por **Connection string** (ou "Connection Details") e copie
   o texto que começa com `postgresql://...`.
4. Isso é o valor da variável `DATABASE_URL`.

## 2. Configurar o envio de e-mail (Gmail)

1. Entre na conta Gmail que vai enviar os relatórios (`wesllleyma@gmail.com`).
2. Ative a **verificação em duas etapas**, se ainda não tiver:
   [myaccount.google.com/security](https://myaccount.google.com/security).
3. Depois de ativada, acesse
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
4. Crie uma nova "senha de app" (pode chamar de "gestor-emprestimos"). O Google vai mostrar
   uma senha de 16 letras — essa é a `GMAIL_APP_PASSWORD` (copie sem espaços).

## 3. Rodar no seu computador (para testar)

1. Instale o [Node.js](https://nodejs.org) (versão 18 ou mais recente), se ainda não tiver.
2. Copie o arquivo `.env.example` para `.env` e preencha:
   - `DATABASE_URL`: da etapa 1.
   - `JWT_SECRET`: qualquer texto longo e aleatório.
   - `GMAIL_USER`: `wesllleyma@gmail.com`.
   - `GMAIL_APP_PASSWORD`: da etapa 2.
   - `RELATORIO_DESTINATARIOS`: `financeiraadm38@gmail.com` (pode colocar mais de um
     separado por vírgula).
   - `JOBS_SECRET`: qualquer outro texto longo e aleatório.
3. No terminal, dentro da pasta `gestor-emprestimos`, rode:
   ```bash
   npm install
   npm start
   ```
4. Abra `http://localhost:3000` no navegador. Na primeira vez, ele vai pedir para criar a
   conta de administrador.
5. Para testar o envio do relatório sem esperar o dia 1 do mês, rode:
   ```bash
   npm run relatorio:teste
   ```
   Isso envia na hora um relatório de teste para o(s) e-mail(s) em
   `RELATORIO_DESTINATARIOS`.

## 4. Publicar na internet (Render.com)

1. Crie uma conta gratuita em [render.com](https://render.com).
2. Suba este projeto para um repositório no GitHub (peça ajuda se precisar).
3. No painel do Render, clique em **New → Web Service**, conecte o repositório do GitHub.
4. O Render vai detectar o `render.yaml` automaticamente. Configure as variáveis de
   ambiente pedidas (`DATABASE_URL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`,
   `RELATORIO_DESTINATARIOS`) com os mesmos valores usados no passo 3.
5. Clique em **Deploy**. Depois de alguns minutos, o Render dá um endereço
   `https://gestor-emprestimos.onrender.com` (ou parecido) — esse é o link do seu site.
6. Acesse o link e crie a conta de administrador na primeira vez.

## 5. Agendar o envio automático do relatório mensal

O site sozinho não "lembra" de enviar o relatório todo mês (o plano gratuito do Render pode
deixar o site "dormindo" quando ninguém acessa). Por isso, usamos um serviço gratuito
externo que acorda o site uma vez por mês:

1. Crie uma conta gratuita em [cron-job.org](https://cron-job.org).
2. Crie um novo "cronjob":
   - **URL**: `https://SEU-SITE.onrender.com/jobs/relatorio-mensal` (troque pelo endereço
     real do seu site no Render).
   - **Método**: `POST`.
   - **Horário**: todo dia 1 de cada mês, às 06:00.
   - Em **Headers** (cabeçalhos), adicione: `x-jobs-secret` = o mesmo valor que você colocou
     em `JOBS_SECRET` no Render.
3. Salve. No dia 1 de cada mês, o relatório do mês anterior chega automaticamente nos
   e-mails configurados em `RELATORIO_DESTINATARIOS`.

## 6. Criando login para funcionários

Depois de logado como administrador, vá em **Usuários → Novo usuário** no menu do site.
Cada funcionário vai enxergar apenas os clientes e empréstimos que ele mesmo cadastrar.
