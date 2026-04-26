const mysql = require('mysql2');
const { dbConfig } = require('./env');

// Configuración de la base de datos (alineada con server.js)
const db = mysql.createConnection(dbConfig);

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

async function ensureTiposSoporte() {
  const tipos = ['INSTALACION', 'MANTENIMIENTO', 'REPARACION'];
  for (const nombre of tipos) {
    await queryAsync(
      'INSERT IGNORE INTO tipos_soporte (nombre, descripcion, activo) VALUES (?, ?, TRUE)',
      [nombre, `${nombre} — seed`, true]
    ).catch(() => {});
  }
}

async function getAnyUserId() {
  try {
    const rows = await queryAsync('SELECT id FROM usuarios ORDER BY id ASC LIMIT 1');
    return rows[0]?.id || null;
  } catch (_) {
    return null;
  }
}

async function run() {
  try {
    console.log('→ Conectando a MySQL y sembrando datos de prueba...');
    await ensureTiposSoporte();
    const userId = await getAnyUserId();
    // Asegurar columna motivo_cancelacion
    await queryAsync(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'motivo_cancelacion'`)
      .then(rows => {
        if (!Array.isArray(rows) || rows.length === 0) {
          return queryAsync(`ALTER TABLE tickets ADD COLUMN motivo_cancelacion VARCHAR(255) DEFAULT NULL`);
        }
      })
      .catch(() => {});

    // Asegurar columna fechaProgramada
    await queryAsync(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'fechaProgramada'`)
      .then(rows => {
        if (!Array.isArray(rows) || rows.length === 0) {
          return queryAsync(`ALTER TABLE tickets ADD COLUMN fechaProgramada DATETIME DEFAULT NULL`);
        }
      })
      .catch(() => {});

    // Datos de ejemplo (sin flujo de pago), incluyendo cancelados con motivo
    const seedTickets = [
      {
        cliente: 'JUAN PEREZ',
        direccion: 'CALLE 1 ZONA 1',
        telefono: '55512345',
        descripcion: 'INSTALACION DE ROUTER',
        tipoSoporte: 'INSTALACION',
        estado: 'pendiente',
        fechaProgramada: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // en 2 días
      },
      {
        cliente: 'MARIA LOPEZ',
        direccion: 'AV. CENTRAL 10-20',
        telefono: '55223344',
        descripcion: 'MANTENIMIENTO DE RED',
        tipoSoporte: 'MANTENIMIENTO',
        estado: 'resuelto',
        fechaProgramada: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString() // mañana
      },
      {
        cliente: 'CARLOS RAMIREZ',
        direccion: 'BARRIO LAS FLORES',
        telefono: '55110022',
        descripcion: 'REPARACION DE CONEXION',
        tipoSoporte: 'REPARACION',
        estado: 'cancelado',
        motivo_cancelacion: 'Cliente ya no requiere el servicio',
        fechaProgramada: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        cliente: 'ANA GOMEZ',
        direccion: 'ZONA 3, CALLE 5',
        telefono: '55778899',
        descripcion: 'CONSULTA GENERAL',
        tipoSoporte: 'MANTENIMIENTO',
        estado: 'cancelado',
        motivo_cancelacion: 'Datos incompletos del requerimiento',
        fechaProgramada: null
      }
    ];

    const insertSql = `
      INSERT INTO tickets (
        cliente, direccion, telefono, descripcion, tipoSoporte, estado,
        fechaProgramada, motivo_cancelacion, creado_por, modificado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const t of seedTickets) {
      const params = [
        t.cliente,
        t.direccion,
        t.telefono,
        t.descripcion,
        t.tipoSoporte,
        t.estado,
        t.fechaProgramada ? new Date(t.fechaProgramada) : null,
        t.motivo_cancelacion || null,
        userId,
        userId
      ];
      await queryAsync(insertSql, params);
      console.log(`   ✓ Insertado ticket para ${t.cliente}`);
    }

    console.log('✅ Seed completado.');
  } catch (err) {
    console.error('❌ Error en el seed:', err);
  } finally {
    db.end();
  }
}

run();
