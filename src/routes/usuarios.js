const express = require('express');
const auth = require('../services/auth');
const db = require('../services/db');

const router = express.Router();

router.get('/usuarios', auth.requireAdmin, async (req, res, next) => {
  try {
    const { rows: usuarios } = await db.query('SELECT * FROM usuarios ORDER BY nome ASC');
    res.render('usuarios/list', { usuarios });
  } catch (err) {
    next(err);
  }
});

router.get('/usuarios/novo', auth.requireAdmin, (req, res) => {
  res.render('usuarios/form', { erro: null });
});

router.post('/usuarios/novo', auth.requireAdmin, async (req, res, next) => {
  try {
    const { nome, usuario, senha, papel, emailRelatorio } = req.body;
    if (!nome || !usuario || !senha) {
      return res.render('usuarios/form', { erro: 'Preencha todos os campos.' });
    }
    await auth.createUser({
      nome,
      usuario,
      senha,
      papel: papel === 'admin' ? 'admin' : 'funcionario',
      emailRelatorio,
    });
    res.redirect('/usuarios');
  } catch (err) {
    if (err.message.includes('Ja existe')) {
      return res.render('usuarios/form', { erro: err.message });
    }
    next(err);
  }
});

router.get('/usuarios/:id', auth.requireAdmin, async (req, res, next) => {
  try {
    const usuario = await auth.findUserById(req.params.id);
    if (!usuario) return res.status(404).render('erro', { mensagem: 'Usuario nao encontrado.' });
    res.render('usuarios/edit', { usuario, erro: null });
  } catch (err) {
    next(err);
  }
});

router.post('/usuarios/:id', auth.requireAdmin, async (req, res, next) => {
  try {
    const usuario = await auth.findUserById(req.params.id);
    if (!usuario) return res.status(404).render('erro', { mensagem: 'Usuario nao encontrado.' });

    const { nome, usuario: novoUsuario, senha, papel, emailRelatorio } = req.body;
    if (!nome || !novoUsuario) {
      return res.render('usuarios/edit', { usuario, erro: 'Preencha todos os campos.' });
    }
    await auth.updateUser(req.params.id, {
      nome,
      usuario: novoUsuario,
      papel: papel === 'admin' ? 'admin' : 'funcionario',
      senha: senha || null,
      emailRelatorio,
    });
    res.redirect('/usuarios');
  } catch (err) {
    if (err.message.includes('Ja existe')) {
      const usuario = await auth.findUserById(req.params.id);
      return res.render('usuarios/edit', { usuario, erro: err.message });
    }
    next(err);
  }
});

module.exports = router;
