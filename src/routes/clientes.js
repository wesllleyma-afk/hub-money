const express = require('express');
const clientesService = require('../services/clientes');
const emprestimosService = require('../services/emprestimos');

const router = express.Router();

router.get('/clientes', async (req, res, next) => {
  try {
    const { id: usuarioId, papel } = req.user;
    const clientes = await clientesService.listClientes({ usuarioId, isAdmin: papel === 'admin' });
    const busca = (req.query.q || '').toLowerCase();
    const filtrados = busca
      ? clientes.filter((c) => c.nome.toLowerCase().includes(busca) || c.cpf.includes(busca))
      : clientes;
    res.render('clientes/list', { clientes: filtrados, busca: req.query.q || '' });
  } catch (err) {
    next(err);
  }
});

router.get('/clientes/novo', (req, res) => {
  res.render('clientes/form', { cliente: null, erro: null });
});

router.post('/clientes/novo', async (req, res, next) => {
  try {
    const { nome, cpf, telefone, endereco, observacoes } = req.body;
    if (!nome) return res.render('clientes/form', { cliente: req.body, erro: 'Informe o nome do cliente.' });
    const cliente = await clientesService.criarCliente({
      usuarioId: req.user.id, nome, cpf, telefone, endereco, observacoes,
    });
    res.redirect(`/clientes/${cliente.id}`);
  } catch (err) {
    next(err);
  }
});

router.get('/clientes/:id', async (req, res, next) => {
  try {
    const cliente = await clientesService.getCliente(req.params.id);
    if (!cliente) return res.status(404).render('erro', { mensagem: 'Cliente nao encontrado.' });
    const emprestimos = await emprestimosService.listEmprestimos({
      usuarioId: req.user.id, isAdmin: req.user.papel === 'admin', clienteId: cliente.id,
    });
    res.render('clientes/detail', { cliente, emprestimos });
  } catch (err) {
    next(err);
  }
});

router.get('/clientes/:id/editar', async (req, res, next) => {
  try {
    const cliente = await clientesService.getCliente(req.params.id);
    if (!cliente) return res.status(404).render('erro', { mensagem: 'Cliente nao encontrado.' });
    res.render('clientes/form', { cliente, erro: null });
  } catch (err) {
    next(err);
  }
});

router.post('/clientes/:id/editar', async (req, res, next) => {
  try {
    const { nome, cpf, telefone, endereco, observacoes } = req.body;
    if (!nome) {
      return res.render('clientes/form', { cliente: { ...req.body, id: req.params.id }, erro: 'Informe o nome do cliente.' });
    }
    await clientesService.atualizarCliente(req.params.id, { nome, cpf, telefone, endereco, observacoes });
    res.redirect(`/clientes/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
