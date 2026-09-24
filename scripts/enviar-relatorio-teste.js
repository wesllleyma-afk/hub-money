require('dotenv').config();
const relatorioMensal = require('../src/services/relatorioMensal');

relatorioMensal
  .gerarEEnviar()
  .then((dados) => {
    console.log('Relatorio enviado com sucesso!');
    console.log('Destinatarios:', dados.destinatarios.join(', '));
    console.log('Periodo do relatorio:', dados.periodo.label);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Erro ao enviar relatorio de teste:', err);
    process.exit(1);
  });
