const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

// Configuración de la base de datos (alineada con server.js)
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'huberto051986',
  database: 'ticket_system'
});

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

async function ensureConfigEmpresaTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS config_empresa (
      id INT PRIMARY KEY,
      empresa_nombre VARCHAR(200),
      login_subtitle VARCHAR(200),
      logo_path VARCHAR(255),
      fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`;
  await queryAsync(sql);
}

async function ensureInitialRow() {
  const rows = await queryAsync('SELECT COUNT(*) AS c FROM config_empresa WHERE id = 1');
  const count = rows && rows[0] ? rows[0].c : 0;
  if (count === 0) {
    // Leer config.json para valores por defecto
    const configPath = path.join(__dirname, 'config.json');
    let empresaNombre = 'DTM Jacaltenango';
    let loginSubtitle = 'Sistema de Tickets de Soporte DTM Jacaltenango';
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      const cfg = JSON.parse(raw);
      empresaNombre = cfg.empresaNombre || empresaNombre;
      loginSubtitle = cfg.loginSubtitle || loginSubtitle;
    } catch (_) {}

    await queryAsync('INSERT INTO config_empresa (id, empresa_nombre, login_subtitle, logo_path) VALUES (1, ?, ?, NULL)', [empresaNombre, loginSubtitle]);
    console.log('✓ Fila inicial creada en config_empresa');
  } else {
    console.log('✓ Fila inicial ya existe en config_empresa');
  }
}

async function migrateExistingLogo() {
  // Detectar logo existente en uploads y registrar su nombre en BD si no está
  const uploadsDir = path.join(__dirname, 'uploads');
  const candidates = ['company-logo.png', 'company-logo.jpg', 'company-logo.jpeg'];
  let found = '';
  for (const f of candidates) {
    const full = path.join(uploadsDir, f);
    try { if (fs.existsSync(full)) { found = f; break; } } catch (_) {}
  }
  if (!found) {
    console.log('No se encontró logo existente en uploads, nada que migrar.');
    return;
  }
  const rows = await queryAsync('SELECT logo_path FROM config_empresa WHERE id = 1');
  const current = rows && rows[0] ? rows[0].logo_path : null;
  if (!current) {
    await queryAsync('UPDATE config_empresa SET logo_path = ? WHERE id = 1', [found]);
    console.log('✓ Logo existente registrado en BD:', found);
  } else {
    console.log('Logo ya registrado en BD, sin cambios.');
  }
}

async function main() {
  try {
    console.log('Conectando a MySQL...');
    await queryAsync('SELECT 1');
    console.log('✓ Conectado');
    await ensureConfigEmpresaTable();
    await ensureInitialRow();
    await migrateExistingLogo();
    console.log('\n✅ Migración de configuración de empresa completada.');
  } catch (err) {
    console.error('❌ Error en migración:', err);
  } finally {
    db.end();
  }
}

main();