const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const COOKIE_NAME = 'sessao';

async function hasAnyUser() {
  const { rows } = await db.query('SELECT 1 FROM usuarios LIMIT 1');
  return rows.length > 0;
}

async function findUserByUsuario(usuario) {
  const { rows } = await db.query('SELECT * FROM usuarios WHERE lower(usuario) = lower($1)', [usuario]);
  return rows[0] || null;
}

async function findUserById(id) {
  const { rows } = await db.query('SELECT * FROM usuarios WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createUser({ nome, usuario, senha, papel, emailRelatorio }) {
  const existing = await findUserByUsuario(usuario);
  if (existing) throw new Error('Ja existe um usuario com esse nome de usuario.');
  const senha_hash = await bcrypt.hash(senha, 10);
  const { rows } = await db.query(
    'INSERT INTO usuarios (nome, usuario, senha_hash, papel, email_relatorio) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [nome, usuario, senha_hash, papel, emailRelatorio || null]
  );
  return rows[0];
}

async function updateUser(id, { nome, usuario, papel, senha, emailRelatorio }) {
  const existing = await findUserByUsuario(usuario);
  if (existing && existing.id !== id) throw new Error('Ja existe um usuario com esse nome de usuario.');

  if (senha) {
    const senha_hash = await bcrypt.hash(senha, 10);
    await db.query(
      'UPDATE usuarios SET nome = $1, usuario = $2, papel = $3, email_relatorio = $4, senha_hash = $5 WHERE id = $6',
      [nome, usuario, papel, emailRelatorio || null, senha_hash, id]
    );
  } else {
    await db.query(
      'UPDATE usuarios SET nome = $1, usuario = $2, papel = $3, email_relatorio = $4 WHERE id = $5',
      [nome, usuario, papel, emailRelatorio || null, id]
    );
  }
}

async function verifyLogin(usuario, senha) {
  const user = await findUserByUsuario(usuario);
  if (!user) return null;
  const ok = await bcrypt.compare(senha, user.senha_hash);
  return ok ? user : null;
}

function signSession(user) {
  return jwt.sign(
    { id: user.id, nome: user.nome, usuario: user.usuario, papel: user.papel },
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
  findUserByUsuario,
  findUserById,
  createUser,
  updateUser,
  verifyLogin,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  requireAdmin,
};
