const express = require('express');
const emprestimosService = require('../services/emprestimos');
const clientesService = require('../services/clientes');
const db = require('../services/db');

const router = express.Router();

router.get('/dashboard', async (req, res, next) => {
  try {
    const { id: usuarioId, papel } = req.user;
    const isAdmin = papel === 'admin';

    const emprestimos = await emprestimosService.listEmprestimos({ usuarioId, isAdmin });
    const clientes = await clientesService.listClientes({ usuarioId, isAdmin });
    const clientesPorId = Object.fromEntries(clientes.map((c) => [c.id, c]));

    const ativos = emprestimos.filter((e) => e.statusExibicao === 'ativo' || e.statusExibicao === 'atrasado');
    const atrasados = emprestimos.filter((e) => e.statusExibicao === 'atrasado');

    const hoje = emprestimosService.todayISO();
    const amanha = emprestimosService.addDaysISO(hoje, 1);
    const vencemHoje = ativos.filter((e) => e.statusExibicao === 'ativo' && e.data_vencimento_atual === hoje);
    const vencemAmanha = ativos.filter((e) => e.statusExibicao === 'ativo' && e.data_vencimento_atual === amanha);

    const comCliente = (lista) => lista.map((e) => ({ ...e, cliente: clientesPorId[e.cliente_id] || null }));

    const totalEmprestado = ativos.reduce((sum, e) => sum + e.valor_principal, 0);
    const totalDevidoAtraso = atrasados.reduce((sum, e) => sum + e.valorQuitacao, 0);

    const mesAtual = new Date().toISOString().slice(0, 7);
    const idsEmprestimosVisiveis = emprestimos.map((e) => e.id);
    const { rows: pagamentosDoMes } = idsEmprestimosVisiveis.length
      ? await db.query(
          `SELECT valor FROM pagamentos
           WHERE data::text LIKE $1 AND emprestimo_id = ANY($2::uuid[])`,
          [`${mesAtual}%`, idsEmprestimosVisiveis]
        )
      : { rows: [] };
    const recebidoNoMes = pagamentosDoMes.reduce((sum, p) => sum + Number(p.valor || 0), 0);

    res.render('dashboard', {
      totalClientes: clientes.length,
      totalEmprestado,
      totalDevidoAtraso,
      qtdAtrasados: atrasados.length,
      recebidoNoMes,
      emprestimosRecentes: emprestimos.slice(0, 8),
      cobrancasHoje: comCliente(vencemHoje),
      cobrancasAmanha: comCliente(vencemAmanha),
      cobrancasAtrasadas: comCliente(atrasados),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
