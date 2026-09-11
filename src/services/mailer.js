const nodemailer = require('nodemailer');

function getTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function getDestinatarios() {
  return String(process.env.RELATORIO_DESTINATARIOS || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

async function enviarEmail({ assunto, html }) {
  const destinatarios = getDestinatarios();
  if (destinatarios.length === 0) {
    throw new Error('Nenhum destinatario configurado em RELATORIO_DESTINATARIOS.');
  }
  const transporte = getTransport();
  await transporte.sendMail({
    from: `"Hub Money" <${process.env.GMAIL_USER}>`,
    to: destinatarios.join(','),
    subject: assunto,
    html,
  });
}

module.exports = { enviarEmail };
