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

async function enviarEmail({ assunto, html, destinatarios }) {
  const lista = destinatarios && destinatarios.length ? destinatarios : getDestinatarios();
  if (lista.length === 0) {
    throw new Error('Nenhum destinatario configurado (cadastre um e-mail de relatorio em Usuarios ou defina RELATORIO_DESTINATARIOS).');
  }
  const transporte = getTransport();
  await transporte.sendMail({
    from: `"Hub Money" <${process.env.GMAIL_USER}>`,
    to: lista.join(','),
    subject: assunto,
    html,
  });
  return lista;
}

module.exports = { enviarEmail, getDestinatarios };
