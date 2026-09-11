const { v4: uuidv4 } = require('uuid');
const sheets = require('./sheets');

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
  let rows = await sheets.readSheet('Emprestimos');
  if (!isAdmin) rows = rows.filter((r) => r.usuario_id === usuarioId);
  if (clienteId) rows = rows.filter((r) => r.cliente_id === clienteId);
  let withState = rows.map((r) => computeLoanState(r));
  if (status) withState = withState.filter((r) => r.statusExibicao === status);
  return withState.sort((a, b) => (a.data_vencimento_atual < b.data_vencimento_atual ? -1 : 1));
}

async function getEmprestimo(id) {
  const loan = await sheets.findById('Emprestimos', id);
  if (!loan) return null;
  const pagamentos = (await sheets.readSheet('Pagamentos'))
    .filter((p) => p.emprestimo_id === id)
    .sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));
  return { ...computeLoanState(loan), pagamentos };
}

async function criarEmprestimo({ usuarioId, clienteId, valorPrincipal, valorJurosCiclo, prazoDias, multaPorDia }) {
  const hoje = todayISO();
  const loan = {
    id: uuidv4(),
    usuario_id: usuarioId,
    cliente_id: clienteId,
    valor_principal: toNumber(valorPrincipal),
    valor_juros_ciclo: toNumber(valorJurosCiclo),
    prazo_dias: toNumber(prazoDias),
    data_inicio: hoje,
    data_vencimento_atual: addDaysISO(hoje, prazoDias),
    multa_por_dia: toNumber(multaPorDia),
    status: 'ativo',
    emprestimo_origem_id: '',
    criado_em: new Date().toISOString(),
  };
  await sheets.appendRow('Emprestimos', loan);
  return loan;
}

async function registrarPagamento({ emprestimoId, valor, tipo, observacao }) {
  const pagamento = {
    id: uuidv4(),
    emprestimo_id: emprestimoId,
    data: todayISO(),
    valor: toNumber(valor),
    tipo,
    observacao: observacao || '',
    criado_em: new Date().toISOString(),
  };
  await sheets.appendRow('Pagamentos', pagamento);
  return pagamento;
}

async function renovar(emprestimoId, valorPago) {
  const loan = await sheets.findById('Emprestimos', emprestimoId);
  if (!loan) throw new Error('Emprestimo nao encontrado.');
  await registrarPagamento({ emprestimoId, valor: valorPago, tipo: 'renovacao' });
  const novaData = addDaysISO(loan.data_vencimento_atual, loan.prazo_dias);
  return sheets.updateRow('Emprestimos', emprestimoId, { data_vencimento_atual: novaData });
}

async function quitar(emprestimoId, valorPago) {
  await registrarPagamento({ emprestimoId, valor: valorPago, tipo: 'quitacao' });
  return sheets.updateRow('Emprestimos', emprestimoId, { status: 'quitado' });
}

async function pagamentoParcial(emprestimoId, valor, observacao) {
  return registrarPagamento({ emprestimoId, valor, tipo: 'parcial', observacao });
}

async function renegociar(emprestimoId, { valorPrincipal, valorJurosCiclo, prazoDias, multaPorDia }) {
  const loanAntigo = await sheets.findById('Emprestimos', emprestimoId);
  if (!loanAntigo) throw new Error('Emprestimo nao encontrado.');
  await sheets.updateRow('Emprestimos', emprestimoId, { status: 'renegociado' });

  const hoje = todayISO();
  const novoLoan = {
    id: uuidv4(),
    usuario_id: loanAntigo.usuario_id,
    cliente_id: loanAntigo.cliente_id,
    valor_principal: toNumber(valorPrincipal),
    valor_juros_ciclo: toNumber(valorJurosCiclo),
    prazo_dias: toNumber(prazoDias),
    data_inicio: hoje,
    data_vencimento_atual: addDaysISO(hoje, prazoDias),
    multa_por_dia: toNumber(multaPorDia),
    status: 'ativo',
    emprestimo_origem_id: emprestimoId,
    criado_em: new Date().toISOString(),
  };
  await sheets.appendRow('Emprestimos', novoLoan);
  return novoLoan;
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
