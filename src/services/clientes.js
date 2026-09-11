const { v4: uuidv4 } = require('uuid');
const sheets = require('./sheets');

async function listClientes({ usuarioId, isAdmin }) {
  let rows = await sheets.readSheet('Clientes');
  if (!isAdmin) rows = rows.filter((r) => r.usuario_id === usuarioId);
  return rows.sort((a, b) => a.nome.localeCompare(b.nome));
}

async function getCliente(id) {
  return sheets.findById('Clientes', id);
}

async function criarCliente({ usuarioId, nome, cpf, telefone, endereco, observacoes }) {
  const cliente = {
    id: uuidv4(),
    usuario_id: usuarioId,
    nome,
    cpf: cpf || '',
    telefone: telefone || '',
    endereco: endereco || '',
    observacoes: observacoes || '',
    criado_em: new Date().toISOString(),
  };
  await sheets.appendRow('Clientes', cliente);
  return cliente;
}

async function atualizarCliente(id, patch) {
  return sheets.updateRow('Clientes', id, patch);
}

module.exports = { listClientes, getCliente, criarCliente, atualizarCliente };
