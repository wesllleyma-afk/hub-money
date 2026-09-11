const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const COOKIE_NAME = 'sessao';

async function hasAnyUser() {
  const { rows } = await db.query('SELECT 1 FROM usuarios LIMIT 1');
  return rows.length > 0;
}

async function findUserByEmail(email) {
  const { rows } = await db.query('SELECT * FROM usuarios WHERE lower(email) = lower($1)', [email]);
  return rows[0] || null;
}

async function createUser({ nome, email, senha, papel }) {
  const existing = await findUserByEmail(email);
  if (existing) throw new Error('Ja existe um usuario com esse e-mail.');
  const senha_hash = await bcrypt.hash(senha, 10);
  const { rows } = await db.query(
    'INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES ($1, $2, $3, $4) RETURNING *',
    [nome, email, senha_hash, papel]
  );
  return rows[0];
}

async function verifyLogin(email, senha) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const ok = await bcrypt.compare(senha, user.senha_hash);
  return ok ? user : null;
}

function signSession(user) {
  return jwt.sign(
    { id: user.id, nome: user.nome, email: user.email, papel: user.papel },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function setSessionCookie(res, user) {
  const token = signSession(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.redirect('/login');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    res.locals.user = req.user;
    next();
  } catch (err) {
    res.redirect('/login');
  }
}

function requireAdmin(req, res, next) {
  if (req.user.papel !== 'admin') {
    return res.status(403).render('erro', { mensagem: 'Apenas o administrador pode acessar esta pagina.' });
  }
  next();
}

module.exports = {
  hasAnyUser,
  findUserByEmail,
  createUser,
  verifyLogin,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  requireAdmin,
};
