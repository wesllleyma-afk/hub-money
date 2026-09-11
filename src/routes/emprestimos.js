const express = require('express');
const emprestimosService = require('../services/emprestimos');
const clientesService = require('../services/clientes');

const router = express.Router();

router.get('/emprestimos', async (req, res, next) => {
  try {
    const { id: usuarioId, papel } = req.user;
    const status = req.query.status || '';
    const emprestimos = await emprestimosService.listEmprestimos({
      usuarioId, isAdmin: papel === 'admin', status: status || undefined,
    });
    const clientes = await clientesService.listClientes({ usuarioId, isAdmin: papel === 'admin' });
    const clientesPorId = Object.fromEntries(clientes.map((c) => [c.id, c]));
    res.render('emprestimos/list', { emprestimos, clientesPorId, statusAtivo: status });
  } catch (err) {
    next(err);
  }
});

router.get('/emprestimos/novo', async (req, res, next) => {
  try {
    const clientes = await clientesService.listClientes({ usuarioId: req.user.id, isAdmin: req.user.papel === 'admin' });
    res.render('emprestimos/form', { clientes, clienteSelecionado: req.query.cliente_id || '', erro: null });
  } catch (err) {
    next(err);
  }
});

router.post('/emprestimos/novo', async (req, res, next) => {
  try {
    const { cliente_id, valor_principal, valor_juros_ciclo, prazo_dias, multa_por_dia } = req.body;
    if (!cliente_id || !valor_principal || !valor_juros_ciclo || !prazo_dias || !multa_por_dia) {
      const clientes = await clientesService.listClientes({ usuarioId: req.user.id, isAdmin: req.user.papel === 'admin' });
      return res.render('emprestimos/form', { clientes, clienteSelecionado: cliente_id, erro: 'Preencha todos os campos.' });
    }
    const emprestimo = await emprestimosService.criarEmprestimo({
      usuarioId: req.user.id,
      clienteId: cliente_id,
      valorPrincipal: valor_principal,
      valorJurosCiclo: valor_juros_ciclo,
      prazoDias: prazo_dias,
      multaPorDia: multa_por_dia,
    });
    res.redirect(`/emprestimos/${emprestimo.id}`);
  } catch (err) {
    next(err);
  }
});

router.get('/emprestimos/:id', async (req, res, next) => {
  try {
    const emprestimo = await emprestimosService.getEmprestimo(req.params.id);
    if (!emprestimo) return res.status(404).render('erro', { mensagem: 'Emprestimo nao encontrado.' });
    const cliente = await clientesService.getCliente(emprestimo.cliente_id);
    res.render('emprestimos/detail', { emprestimo, cliente, erro: null });
  } catch (err) {
    next(err);
  }
});

router.post('/emprestimos/:id/renovar', async (req, res, next) => {
  try {
    const { valor_pago } = req.body;
    await emprestimosService.renovar(req.params.id, valor_pago);
    res.redirect(`/emprestimos/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/emprestimos/:id/quitar', async (req, res, next) => {
  try {
    const { valor_pago } = req.body;
    await emprestimosService.quitar(req.params.id, valor_pago);
    res.redirect(`/emprestimos/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/emprestimos/:id/pagamento-parcial', async (req, res, next) => {
  try {
    const { valor, observacao } = req.body;
    await emprestimosService.pagamentoParcial(req.params.id, valor, observacao);
    res.redirect(`/emprestimos/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/emprestimos/:id/renegociar', async (req, res, next) => {
  try {
    const { valor_principal, valor_juros_ciclo, prazo_dias, multa_por_dia } = req.body;
    const novo = await emprestimosService.renegociar(req.params.id, {
      valorPrincipal: valor_principal,
      valorJurosCiclo: valor_juros_ciclo,
      prazoDias: prazo_dias,
      multaPorDia: multa_por_dia,
    });
    res.redirect(`/emprestimos/${novo.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
