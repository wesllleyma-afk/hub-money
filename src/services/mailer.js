const nodemailer = require('nodemailer');
const db = require('./db');

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

async function destinatariosCadastrados() {
  const { rows } = await db.query(
    `SELECT DISTINCT email_relatorio FROM usuarios
     WHERE email_relatorio IS NOT NULL AND trim(email_relatorio) <> ''`
  );
  return rows.map((r) => r.email_relatorio);
}

// E-mails cadastrados por usuario tem prioridade; RELATORIO_DESTINATARIOS do .env e so reserva.
async function resolverDestinatarios() {
  const doBanco = await destinatariosCadastrados();
  return doBanco.length ? doBanco : getDestinatarios();
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

module.exports = { enviarEmail, getDestinatarios, destinatariosCadastrados, resolverDestinatarios };
