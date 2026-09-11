const db = require('./db');

function toNumber(v) {
  return Number(v) || 0;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(dateISO, days) {
  const d = new Date(dateISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

function diffDays(fromISO, toISO) {
  const a = new Date(fromISO + 'T00:00:00Z');
  const b = new Date(toISO + 'T00:00:00Z');
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// Calcula os valores atuais de um emprestimo (nao grava nada, e so leitura)
function computeLoanState(loan, refDateISO = todayISO()) {
  const valorPrincipal = toNumber(loan.valor_principal);
  const valorJuros = toNumber(loan.valor_juros_ciclo);
  const multaPorDia = toNumber(loan.multa_por_dia);

  const diasAtraso = loan.status === 'ativo' ? Math.max(0, diffDays(loan.data_vencimento_atual, refDateISO)) : 0;
  const multaAcumulada = diasAtraso * multaPorDia;
  const valorRenovacao = valorJuros + multaAcumulada;
  const valorQuitacao = valorPrincipal + valorJuros + multaAcumulada;
  const statusExibicao = loan.status === 'ativo' && diasAtraso > 0 ? 'atrasado' : loan.status;

  return {
    ...loan,
    valor_principal: valorPrincipal,
    valor_juros_ciclo: valorJuros,
    multa_por_dia: multaPorDia,
    diasAtraso,
    multaAcumulada,
    valorRenovacao,
    valorQuitacao,
    statusExibicao,
  };
}

async function listEmprestimos({ usuarioId, isAdmin, clienteId, status } = {}) {
  const conditions = [];
  const params = [];
  if (!isAdmin) {
    params.push(usuarioId);
    conditions.push(`usuario_id = $${params.length}`);
  }
  if (clienteId) {
    params.push(clienteId);
    conditions.push(`cliente_id = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await db.query(`SELECT * FROM emprestimos ${where}`, params);

  let withState = rows.map((r) => computeLoanState(r));
  if (status) withState = withState.filter((r) => r.statusExibicao === status);
  return withState.sort((a, b) => (a.data_vencimento_atual < b.data_vencimento_atual ? -1 : 1));
}

async function getEmprestimo(id) {
  const { rows } = await db.query('SELECT * FROM emprestimos WHERE id = $1', [id]);
  const loan = rows[0];
  if (!loan) return null;
  const pagamentosRes = await db.query(
    'SELECT * FROM pagamentos WHERE emprestimo_id = $1 ORDER BY criado_em DESC',
    [id]
  );
  return { ...computeLoanState(loan), pagamentos: pagamentosRes.rows };
}

async function criarEmprestimo({ usuarioId, clienteId, valorPrincipal, valorJurosCiclo, prazoDias, multaPorDia }) {
  const hoje = todayISO();
  const { rows } = await db.query(
    `INSERT INTO emprestimos
       (usuario_id, cliente_id, valor_principal, valor_juros_ciclo, prazo_dias,
        data_inicio, data_vencimento_atual, multa_por_dia, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ativo')
     RETURNING *`,
    [usuarioId, clienteId, toNumber(valorPrincipal), toNumber(valorJurosCiclo), toNumber(prazoDias),
      hoje, addDaysISO(hoje, prazoDias), toNumber(multaPorDia)]
  );
  return rows[0];
}

async function registrarPagamento({ emprestimoId, valor, tipo, observacao, valorJuros, valorMulta, valorPrincipal }) {
  const { rows } = await db.query(
    `INSERT INTO pagamentos (emprestimo_id, data, valor, tipo, observacao, valor_juros, valor_multa, valor_principal)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [emprestimoId, todayISO(), toNumber(valor), tipo, observacao || '',
      toNumber(valorJuros), toNumber(valorMulta), toNumber(valorPrincipal)]
  );
  return rows[0];
}

async function renovar(emprestimoId, valorPago) {
  const { rows } = await db.query('SELECT * FROM emprestimos WHERE id = $1', [emprestimoId]);
  const loan = rows[0];
  if (!loan) throw new Error('Emprestimo nao encontrado.');
  const estado = computeLoanState(loan);
  await registrarPagamento({
    emprestimoId, valor: valorPago, tipo: 'renovacao',
    valorJuros: estado.valor_juros_ciclo, valorMulta: estado.multaAcumulada,
  });
  const novaData = addDaysISO(loan.data_vencimento_atual, loan.prazo_dias);
  const updated = await db.query(
    'UPDATE emprestimos SET data_vencimento_atual = $2 WHERE id = $1 RETURNING *',
    [emprestimoId, novaData]
  );
  return updated.rows[0];
}

async function quitar(emprestimoId, valorPago) {
  const { rows } = await db.query('SELECT * FROM emprestimos WHERE id = $1', [emprestimoId]);
  const loan = rows[0];
  if (!loan) throw new Error('Emprestimo nao encontrado.');
  const estado = computeLoanState(loan);
  await registrarPagamento({
    emprestimoId, valor: valorPago, tipo: 'quitacao',
    valorJuros: estado.valor_juros_ciclo, valorMulta: estado.multaAcumulada, valorPrincipal: estado.valor_principal,
  });
  const updated = await db.query(
    "UPDATE emprestimos SET status = 'quitado' WHERE id = $1 RETURNING *",
    [emprestimoId]
  );
  return updated.rows[0];
}

async function pagamentoParcial(emprestimoId, valor, observacao) {
  return registrarPagamento({ emprestimoId, valor, tipo: 'parcial', observacao });
}

async function renegociar(emprestimoId, { valorPrincipal, valorJurosCiclo, prazoDias, multaPorDia }) {
  const { rows } = await db.query('SELECT * FROM emprestimos WHERE id = $1', [emprestimoId]);
  const loanAntigo = rows[0];
  if (!loanAntigo) throw new Error('Emprestimo nao encontrado.');
  await db.query("UPDATE emprestimos SET status = 'renegociado' WHERE id = $1", [emprestimoId]);

  const hoje = todayISO();
  const novo = await db.query(
    `INSERT INTO emprestimos
       (usuario_id, cliente_id, valor_principal, valor_juros_ciclo, prazo_dias,
        data_inicio, data_vencimento_atual, multa_por_dia, status, emprestimo_origem_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ativo', $9)
     RETURNING *`,
    [loanAntigo.usuario_id, loanAntigo.cliente_id, toNumber(valorPrincipal), toNumber(valorJurosCiclo),
      toNumber(prazoDias), hoje, addDaysISO(hoje, prazoDias), toNumber(multaPorDia), emprestimoId]
  );
  return novo.rows[0];
}

module.exports = {
  todayISO,
  computeLoanState,
  listEmprestimos,
  getEmprestimo,
  criarEmprestimo,
  renovar,
  quitar,
  pagamentoParcial,
  renegociar,
};
