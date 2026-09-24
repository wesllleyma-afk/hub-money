const { Pool, types } = require('pg');

// Sem isso, colunas "date" voltam como objeto Date (fuso local), o que quebra
// comparacoes/strings tipo YYYY-MM-DD usadas em toda a aplicacao (ex: data.startsWith).
types.setTypeParser(1082, (val) => val);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function query(text, params) {
  return pool.query(text, params);
}

async function migrate() {
  await query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nome text NOT NULL,
      usuario text NOT NULL UNIQUE,
      email_relatorio text,
      senha_hash text NOT NULL,
      papel text NOT NULL DEFAULT 'funcionario',
      criado_em timestamptz NOT NULL DEFAULT now()
    )
  `);

  // Bancos criados antes da troca de "email" (login) por "usuario" (apelido livre).
  await query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'email')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'usuario') THEN
        ALTER TABLE usuarios RENAME COLUMN email TO usuario;
      END IF;
    END $$;
  `);
  await query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_relatorio text');

  await query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id uuid NOT NULL REFERENCES usuarios(id),
      nome text NOT NULL,
      cpf text DEFAULT '',
      telefone text DEFAULT '',
      endereco text DEFAULT '',
      observacoes text DEFAULT '',
      criado_em timestamptz NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS emprestimos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id uuid NOT NULL REFERENCES usuarios(id),
      cliente_id uuid NOT NULL REFERENCES clientes(id),
      valor_principal numeric NOT NULL,
      valor_juros_ciclo numeric NOT NULL,
      prazo_dias integer NOT NULL,
      data_inicio date NOT NULL,
      data_vencimento_atual date NOT NULL,
      multa_por_dia numeric NOT NULL,
      status text NOT NULL DEFAULT 'ativo',
      emprestimo_origem_id uuid REFERENCES emprestimos(id),
      criado_em timestamptz NOT NULL DEFAULT now()
    )
  `);
  await query('ALTER TABLE emprestimos ADD COLUMN IF NOT EXISTS cobranca_confirmada_em date');

  await query(`
    CREATE TABLE IF NOT EXISTS pagamentos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      emprestimo_id uuid NOT NULL REFERENCES emprestimos(id),
      data date NOT NULL,
      valor numeric NOT NULL,
      tipo text NOT NULL,
      observacao text DEFAULT '',
      valor_juros numeric NOT NULL DEFAULT 0,
      valor_multa numeric NOT NULL DEFAULT 0,
      valor_principal numeric NOT NULL DEFAULT 0,
      criado_em timestamptz NOT NULL DEFAULT now()
    )
  `);
}

module.exports = { pool, query, migrate };
