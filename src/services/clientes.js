const db = require('./db');

async function listClientes({ usuarioId, isAdmin }) {
  const { rows } = isAdmin
    ? await db.query('SELECT * FROM clientes ORDER BY nome ASC')
    : await db.query('SELECT * FROM clientes WHERE usuario_id = $1 ORDER BY nome ASC', [usuarioId]);
  return rows;
}

async function getCliente(id) {
  const { rows } = await db.query('SELECT * FROM clientes WHERE id = $1', [id]);
  return rows[0] || null;
}

async function criarCliente({ usuarioId, nome, cpf, telefone, endereco, observacoes }) {
  const { rows } = await db.query(
    `INSERT INTO clientes (usuario_id, nome, cpf, telefone, endereco, observacoes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [usuarioId, nome, cpf || '', telefone || '', endereco || '', observacoes || '']
  );
  return rows[0];
}

async function atualizarCliente(id, { nome, cpf, telefone, endereco, observacoes }) {
  const { rows } = await db.query(
    `UPDATE clientes SET nome = $2, cpf = $3, telefone = $4, endereco = $5, observacoes = $6
     WHERE id = $1 RETURNING *`,
    [id, nome, cpf || '', telefone || '', endereco || '', observacoes || '']
  );
  return rows[0];
}

module.exports = { listClientes, getCliente, criarCliente, atualizarCliente };
