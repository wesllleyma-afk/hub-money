const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const SHEETS_CONFIG = {
  Usuarios: ['id', 'nome', 'email', 'senha_hash', 'papel', 'criado_em'],
  Clientes: ['id', 'usuario_id', 'nome', 'cpf', 'telefone', 'endereco', 'observacoes', 'criado_em'],
  Emprestimos: [
    'id', 'usuario_id', 'cliente_id', 'valor_principal', 'valor_juros_ciclo',
    'prazo_dias', 'data_inicio', 'data_vencimento_atual', 'multa_por_dia',
    'status', 'emprestimo_origem_id', 'criado_em',
  ],
  Pagamentos: ['id', 'emprestimo_id', 'data', 'valor', 'tipo', 'observacao', 'criado_em'],
};

let sheetsClientPromise = null;

function getSheetsClient() {
  if (!sheetsClientPromise) {
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheetsClientPromise = auth.authorize().then(() => google.sheets({ version: 'v4', auth }));
  }
  return sheetsClientPromise;
}

function columnLetter(index) {
  let letter = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

async function ensureSheetsExist() {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingTitles = meta.data.sheets.map((s) => s.properties.title);

  const missing = Object.keys(SHEETS_CONFIG).filter((name) => !existingTitles.includes(name));
  if (missing.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: missing.map((name) => ({ addSheet: { properties: { title: name } } })),
      },
    });
  }

  for (const name of Object.keys(SHEETS_CONFIG)) {
    const header = SHEETS_CONFIG[name];
    const lastCol = columnLetter(header.length - 1);
    const range = `${name}!A1:${lastCol}1`;
    const current = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    const currentHeader = (current.data.values && current.data.values[0]) || [];
    if (currentHeader.join('|') !== header.join('|')) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: 'RAW',
        requestBody: { values: [header] },
      });
    }
  }
}

function rowToObject(header, row) {
  const obj = {};
  header.forEach((key, i) => {
    obj[key] = row[i] !== undefined ? row[i] : '';
  });
  return obj;
}

function objectToRow(header, obj) {
  return header.map((key) => (obj[key] !== undefined && obj[key] !== null ? obj[key] : ''));
}

async function readSheet(sheetName) {
  const header = SHEETS_CONFIG[sheetName];
  const sheets = await getSheetsClient();
  const lastCol = columnLetter(header.length - 1);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:${lastCol}100000`,
  });
  const rows = res.data.values || [];
  return rows
    .map((row, i) => ({ ...rowToObject(header, row), _rowNumber: i + 2 }))
    .filter((obj) => obj.id);
}

async function appendRow(sheetName, obj) {
  const header = SHEETS_CONFIG[sheetName];
  const sheets = await getSheetsClient();
  const row = objectToRow(header, obj);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
  return obj;
}

async function findById(sheetName, id) {
  const rows = await readSheet(sheetName);
  return rows.find((r) => r.id === id) || null;
}

async function updateRow(sheetName, id, patch) {
  const header = SHEETS_CONFIG[sheetName];
  const existing = await findById(sheetName, id);
  if (!existing) throw new Error(`Registro ${id} nao encontrado em ${sheetName}`);
  const updated = { ...existing, ...patch };
  const sheets = await getSheetsClient();
  const lastCol = columnLetter(header.length - 1);
  const range = `${sheetName}!A${existing._rowNumber}:${lastCol}${existing._rowNumber}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [objectToRow(header, updated)] },
  });
  return updated;
}

module.exports = {
  SHEETS_CONFIG,
  ensureSheetsExist,
  readSheet,
  appendRow,
  findById,
  updateRow,
};
