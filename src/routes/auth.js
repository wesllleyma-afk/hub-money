const express = require('express');
const auth = require('../services/auth');

const router = express.Router();

router.get('/setup', async (req, res, next) => {
  try {
    if (await auth.hasAnyUser()) return res.redirect('/login');
    res.render('setup', { erro: null });
  } catch (err) {
    next(err);
  }
});

router.post('/setup', async (req, res, next) => {
  try {
    if (await auth.hasAnyUser()) return res.redirect('/login');
    const { nome, usuario, senha } = req.body;
    if (!nome || !usuario || !senha) {
      return res.render('setup', { erro: 'Preencha todos os campos.' });
    }
    const user = await auth.createUser({ nome, usuario, senha, papel: 'admin' });
    auth.setSessionCookie(res, user);
    res.redirect('/dashboard');
  } catch (err) {
    next(err);
  }
});

router.get('/login', async (req, res, next) => {
  try {
    if (!(await auth.hasAnyUser())) return res.redirect('/setup');
    res.render('login', { erro: null });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { usuario, senha } = req.body;
    const user = await auth.verifyLogin(usuario, senha);
    if (!user) return res.render('login', { erro: 'Usuario ou senha invalidos.' });
    auth.setSessionCookie(res, user);
    res.redirect('/dashboard');
  } catch (err) {
    next(err);
  }
});

router.get('/logout', (req, res) => {
  auth.clearSessionCookie(res);
  res.redirect('/login');
});

module.exports = router;
