const express = require('express');
const auth = require('../services/auth');
const sheets = require('../services/sheets');

const router = express.Router();

router.get('/usuarios', auth.requireAdmin, async (req, res, next) => {
  try {
    const usuarios = await sheets.readSheet('Usuarios');
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
    const { nome, email, senha, papel } = req.body;
    if (!nome || !email || !senha) {
      return res.render('usuarios/form', { erro: 'Preencha todos os campos.' });
    }
    await auth.createUser({ nome, email, senha, papel: papel === 'admin' ? 'admin' : 'funcionario' });
    res.redirect('/usuarios');
  } catch (err) {
    if (err.message.includes('Ja existe')) {
      return res.render('usuarios/form', { erro: err.message });
    }
    next(err);
  }
});

module.exports = router;
