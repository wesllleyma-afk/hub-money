const express = require('express');
const relatorioMensal = require('../services/relatorioMensal');

const router = express.Router();

router.post('/jobs/relatorio-mensal', async (req, res, next) => {
  try {
    const segredo = req.header('x-jobs-secret');
    if (!process.env.JOBS_SECRET || segredo !== process.env.JOBS_SECRET) {
      return res.status(403).json({ erro: 'Nao autorizado.' });
    }
    const dados = await relatorioMensal.gerarEEnviar();
    res.json({ ok: true, periodo: dados.periodo });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
