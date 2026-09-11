const express = require('express');
const emprestimosService = require('../services/emprestimos');
const clientesService = require('../services/clientes');
const sheets = require('../services/sheets');

const router = express.Router();

router.get('/dashboard', async (req, res, next) => {
  try {
    const { id: usuarioId, papel } = req.user;
    const isAdmin = papel === 'admin';

    const emprestimos = await emprestimosService.listEmprestimos({ usuarioId, isAdmin });
    const clientes = await clientesService.listClientes({ usuarioId, isAdmin });

    const ativos = emprestimos.filter((e) => e.statusExibicao === 'ativo' || e.statusExibicao === 'atrasado');
    const atrasados = emprestimos.filter((e) => e.statusExibicao === 'atrasado');

    const totalEmprestado = ativos.reduce((sum, e) => sum + e.valor_principal, 0);
    const totalDevidoAtraso = atrasados.reduce((sum, e) => sum + e.valorQuitacao, 0);

    const mesAtual = new Date().toISOString().slice(0, 7);
    const todosPagamentos = await sheets.readSheet('Pagamentos');
    const idsEmprestimosVisiveis = new Set(emprestimos.map((e) => e.id));
    const recebidoNoMes = todosPagamentos
      .filter((p) => p.data.startsWith(mesAtual) && idsEmprestimosVisiveis.has(p.emprestimo_id))
      .reduce((sum, p) => sum + Number(p.valor || 0), 0);

    res.render('dashboard', {
      totalClientes: clientes.length,
      totalEmprestado,
      totalDevidoAtraso,
      qtdAtrasados: atrasados.length,
      recebidoNoMes,
      emprestimosRecentes: emprestimos.slice(0, 8),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
