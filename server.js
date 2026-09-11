require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');

const db = require('./src/services/db');
const auth = require('./src/services/auth');
const authRoutes = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard');
const clientesRoutes = require('./src/routes/clientes');
const emprestimosRoutes = require('./src/routes/emprestimos');
const relatoriosRoutes = require('./src/routes/relatorios');
const usuariosRoutes = require('./src/routes/usuarios');
const jobsRoutes = require('./src/routes/jobs');

const app = express();

app.set('view engine', 'ejs');
app.set('views', './src/views');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(cookieParser());

app.use((req, res, next) => {
  res.locals.user = null;
  next();
});

// Rota chamada por um agendador externo (sem login, protegida por segredo) - ver SETUP.md
app.use(jobsRoutes);

app.use(authRoutes);
app.use(auth.requireAuth, dashboardRoutes);
app.use(auth.requireAuth, clientesRoutes);
app.use(auth.requireAuth, emprestimosRoutes);
app.use(auth.requireAuth, relatoriosRoutes);
app.use(auth.requireAuth, usuariosRoutes);

app.get('/', (req, res) => res.redirect('/dashboard'));

app.use((req, res) => {
  res.status(404).render('erro', { mensagem: 'Pagina nao encontrada.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('erro', { mensagem: 'Ocorreu um erro: ' + err.message });
});

const PORT = process.env.PORT || 3000;

db.migrate()
  .then(() => {
    app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Erro ao conectar no banco de dados. Verifique o SETUP.md e a variavel DATABASE_URL.');
    console.error(err);
    process.exit(1);
  });
