const express = require('express');
const emprestimosService = require('../services/emprestimos');
const clientesService = require('../services/clientes');

const router = express.Router();

router.get('/relatorios', async (req, res, next) => {
  try {
    const { id: usuarioId, papel } = req.user;
    const isAdmin = papel === 'admin';
    const emprestimos = await emprestimosService.listEmprestimos({ usuarioId, isAdmin });
    const clientes = await clientesService.listClientes({ usuarioId, isAdmin });
    const clientesPorId = Object.fromEntries(clientes.map((c) => [c.id, c]));

    const ativos = emprestimos.filter((e) => e.statusExibicao === 'ativo');
    const atrasados = emprestimos.filter((e) => e.statusExibicao === 'atrasado');
    const quitados = emprestimos.filter((e) => e.statusExibicao === 'quitado');
    const renegociados = emprestimos.filter((e) => e.statusExibicao === 'renegociado');

    const totais = {
      capitalEmAberto: [...ativos, ...atrasados].reduce((s, e) => s + e.valor_principal, 0),
      jurosPrevistoCiclo: [...ativos, ...atrasados].reduce((s, e) => s + e.valor_juros_ciclo, 0),
      multasAcumuladas: atrasados.reduce((s, e) => s + e.multaAcumulada, 0),
      totalAReceberSeQuitarTudo: [...ativos, ...atrasados].reduce((s, e) => s + e.valorQuitacao, 0),
    };

    res.render('relatorios/index', {
      emprestimos, clientesPorId, totais,
      contagem: { ativos: ativos.length, atrasados: atrasados.length, quitados: quitados.length, renegociados: renegociados.length },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
