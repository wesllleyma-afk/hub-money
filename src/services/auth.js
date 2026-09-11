const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const sheets = require('./sheets');

const COOKIE_NAME = 'sessao';

async function hasAnyUser() {
  const users = await sheets.readSheet('Usuarios');
  return users.length > 0;
}

async function findUserByEmail(email) {
  const users = await sheets.readSheet('Usuarios');
  return users.find((u) => u.email.toLowerCase() === String(email).toLowerCase()) || null;
}

async function createUser({ nome, email, senha, papel }) {
  const existing = await findUserByEmail(email);
  if (existing) throw new Error('Ja existe um usuario com esse e-mail.');
  const senha_hash = await bcrypt.hash(senha, 10);
  const user = {
    id: uuidv4(),
    nome,
    email,
    senha_hash,
    papel,
    criado_em: new Date().toISOString(),
  };
  await sheets.appendRow('Usuarios', user);
  return user;
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
