const mysql = require('mysql2');
const { dbConfig } = require('./env');

const db = mysql.createConnection(dbConfig);

function describe(table) {
  return new Promise((resolve, reject) => {
    db.query(`DESCRIBE ${table}`, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function run(sql) {
  return new Promise((resolve, reject) => {
    db.query(sql, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
}

async function main() {
  try {
    console.log('Conectando y verificando tabla usuarios...');
    const rows = await describe('usuarios');
    const cols = rows.map(r => r.Field);
    const ops = [];
    if (!cols.includes('fecha_actualizacion')) {
      ops.push('ALTER TABLE usuarios ADD COLUMN fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    }
    if (ops.length === 0) {
      console.log('✓ Nada que actualizar en usuarios.');
    } else {
      for (const sql of ops) {
        console.log('→ Ejecutando:', sql);
        await run(sql);
      }
      console.log('✓ Actualización de usuarios completada.');
    }
    const final = await describe('usuarios');
    console.table(final);
  } catch (e) {
    console.error('Error actualizando usuarios:', e);
  } finally {
    db.end();
    console.log('Conexión cerrada.');
  }
}

main();
