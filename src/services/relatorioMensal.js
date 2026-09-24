const db = require('./db');
const emprestimosService = require('./emprestimos');
const clientesService = require('./clientes');
const mailer = require('./mailer');

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function periodoMesAnterior(ref = new Date()) {
  const inicio = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - 1, 1));
  const fim = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 0));
  const toISO = (d) => d.toISOString().slice(0, 10);
  return {
    inicio: toISO(inicio),
    fim: toISO(fim),
    label: `${NOMES_MES[inicio.getUTCMonth()]}/${inicio.getUTCFullYear()}`,
  };
}

async function coletarDados(periodo) {
  const novos = await db.query(
    `SELECT count(*)::int as qtd, COALESCE(sum(valor_principal), 0) as total
     FROM emprestimos WHERE data_inicio BETWEEN $1 AND $2`,
    [periodo.inicio, periodo.fim]
  );

  const recebido = await db.query(
    `SELECT COALESCE(sum(valor), 0) as total, COALESCE(sum(valor_juros), 0) as juros,
            COALESCE(sum(valor_multa), 0) as multas, COALESCE(sum(valor_principal), 0) as capital
     FROM pagamentos WHERE data BETWEEN $1 AND $2`,
    [periodo.inicio, periodo.fim]
  );

  const quitados = await db.query(
    `SELECT count(*)::int as qtd FROM pagamentos WHERE tipo = 'quitacao' AND data BETWEEN $1 AND $2`,
    [periodo.inicio, periodo.fim]
  );

  const renegociados = await db.query(
    `SELECT count(*)::int as qtd FROM emprestimos
     WHERE emprestimo_origem_id IS NOT NULL AND data_inicio BETWEEN $1 AND $2`,
    [periodo.inicio, periodo.fim]
  );

  const carteira = await emprestimosService.listEmprestimos({ isAdmin: true });
  const clientes = await clientesService.listClientes({ isAdmin: true });
  const clientesPorId = Object.fromEntries(clientes.map((c) => [c.id, c]));

  const ativos = carteira.filter((e) => e.statusExibicao === 'ativo');
  const atrasados = carteira.filter((e) => e.statusExibicao === 'atrasado');

  return {
    periodo,
    novosEmprestimos: { qtd: novos.rows[0].qtd, total: Number(novos.rows[0].total) },
    recebidoNoMes: {
      total: Number(recebido.rows[0].total),
      juros: Number(recebido.rows[0].juros),
      multas: Number(recebido.rows[0].multas),
      capital: Number(recebido.rows[0].capital),
    },
    quitadosNoMes: { qtd: quitados.rows[0].qtd },
    renegociadosNoMes: { qtd: renegociados.rows[0].qtd },
    carteiraAtual: {
      ativos: { qtd: ativos.length, total: ativos.reduce((s, e) => s + e.valor_principal, 0) },
      atrasados: { qtd: atrasados.length, total: atrasados.reduce((s, e) => s + e.valorQuitacao, 0) },
      listaAtrasados: atrasados.map((e) => ({
        cliente: clientesPorId[e.cliente_id] ? clientesPorId[e.cliente_id].nome : '—',
        diasAtraso: e.diasAtraso,
        valorDevido: e.valorQuitacao,
      })),
    },
  };
}

function formatarMoeda(v) {
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
}

function gerarHtml(dados) {
  const linhasAtrasados = dados.carteiraAtual.listaAtrasados.length
    ? dados.carteiraAtual.listaAtrasados
        .map((c) => `<tr><td>${c.cliente}</td><td>${c.diasAtraso} dia(s)</td><td>${formatarMoeda(c.valorDevido)}</td></tr>`)
        .join('')
    : '<tr><td colspan="3">Nenhum cliente em atraso.</td></tr>';

  return `
    <div style="font-family: Arial, sans-serif; color: #222; max-width: 640px;">
      <h2>Fechamento de ${dados.periodo.label}</h2>

      <h3>Movimento do mês</h3>
      <ul>
        <li>Novos empréstimos: ${dados.novosEmprestimos.qtd} (${formatarMoeda(dados.novosEmprestimos.total)})</li>
        <li>Total recebido: ${formatarMoeda(dados.recebidoNoMes.total)}</li>
        <li style="margin-left:16px;">Juros recebidos: ${formatarMoeda(dados.recebidoNoMes.juros)}</li>
        <li style="margin-left:16px;">Multas recebidas: ${formatarMoeda(dados.recebidoNoMes.multas)}</li>
        <li style="margin-left:16px;">Capital devolvido (quitações): ${formatarMoeda(dados.recebidoNoMes.capital)}</li>
        <li>Empréstimos quitados no mês: ${dados.quitadosNoMes.qtd}</li>
        <li>Empréstimos renegociados no mês: ${dados.renegociadosNoMes.qtd}</li>
      </ul>

      <h3>Situação atual da carteira</h3>
      <ul>
        <li>Ativos em dia: ${dados.carteiraAtual.ativos.qtd} (capital emprestado: ${formatarMoeda(dados.carteiraAtual.ativos.total)})</li>
        <li>Em atraso: ${dados.carteiraAtual.atrasados.qtd} (a receber: ${formatarMoeda(dados.carteiraAtual.atrasados.total)})</li>
      </ul>

      <h3>Clientes em atraso</h3>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <thead><tr><th>Cliente</th><th>Dias de atraso</th><th>Valor devido</th></tr></thead>
        <tbody>${linhasAtrasados}</tbody>
      </table>
    </div>
  `;
}

async function gerarEEnviar(refDate = new Date()) {
  const periodo = periodoMesAnterior(refDate);
  const dados = await coletarDados(periodo);
  const html = gerarHtml(dados);
  const destinatarios = await mailer.resolverDestinatarios();
  const enviadosPara = await mailer.enviarEmail({ assunto: `Fechamento financeiro - ${periodo.label}`, html, destinatarios });
  return { ...dados, destinatarios: enviadosPara };
}

module.exports = { periodoMesAnterior, coletarDados, gerarHtml, gerarEEnviar };
