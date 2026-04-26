require('dotenv').config();

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const splitCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ticket_system'
};

const poolConfig = {
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10),
  queueLimit: toInt(process.env.DB_QUEUE_LIMIT, 0)
};

const clientUrls = Array.from(new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3021',
  ...splitCsv(process.env.CLIENT_URLS)
]));

const appBaseUrl = String(process.env.APP_BASE_URL || '').trim().replace(/\/+$/, '');

module.exports = {
  appBaseUrl,
  clientUrls,
  dbConfig,
  jwtSecret: process.env.JWT_SECRET || 'dtm_jacaltenango_secret_key_2024',
  poolConfig,
  port: toInt(process.env.PORT, 3001)
};
