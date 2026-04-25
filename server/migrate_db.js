const mysql = require('mysql2');

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

async function ensureUsuariosTable() {
  console.log('→ Creando tabla usuarios si no existe...');
  const sql = `
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      nombre VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      rol ENUM('admin', 'tecnico', 'usuario') DEFAULT 'usuario',
      activo BOOLEAN DEFAULT TRUE,
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;
  await queryAsync(sql);
}

async function ensureAuditoriaTable() {
  console.log('→ Creando tabla auditoria si no existe...');
  const sql = `
    CREATE TABLE IF NOT EXISTS auditoria (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tabla_afectada VARCHAR(50) NOT NULL,
      id_registro INT NOT NULL,
      accion ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
      datos_anteriores JSON,
      datos_nuevos JSON,
      usuario_id INT,
      fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `;
  await queryAsync(sql);
}

async function ensureTicketsColumns() {
  console.log('→ Verificando columnas creado_por/modificado_por en tickets...');
  const desc = await queryAsync('DESCRIBE tickets');
  const fields = desc.map(r => r.Field);
  const ops = [];
  if (!fields.includes('creado_por')) ops.push('ALTER TABLE tickets ADD COLUMN creado_por INT DEFAULT NULL');
  if (!fields.includes('modificado_por')) ops.push('ALTER TABLE tickets ADD COLUMN modificado_por INT DEFAULT NULL');
  if (!fields.includes('precio')) ops.push('ALTER TABLE tickets ADD COLUMN precio DECIMAL(10,2) DEFAULT NULL');
  if (!fields.includes('cobro_aplica')) ops.push('ALTER TABLE tickets ADD COLUMN cobro_aplica BOOLEAN DEFAULT FALSE');
  if (!fields.includes('pago')) ops.push('ALTER TABLE tickets ADD COLUMN pago DECIMAL(10,2) DEFAULT NULL');
  for (const sql of ops) {
    console.log('   - Ejecutando:', sql);
    await queryAsync(sql);
  }
}

async function ensureIndices() {
  console.log('→ Creando índices de auditoria si no existen...');
  const idxs = [
    { name: 'idx_auditoria_tabla_id', table: 'auditoria', columns: '(tabla_afectada, id_registro)' },
    { name: 'idx_auditoria_usuario', table: 'auditoria', columns: '(usuario_id)' },
    { name: 'idx_auditoria_fecha', table: 'auditoria', columns: '(fecha_accion)' },
  ];
  for (const idx of idxs) {
    const exists = await queryAsync(`
      SELECT 1 FROM information_schema.statistics 
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
    `, [idx.table, idx.name]);
    if (exists.length === 0) {
      const create = `CREATE INDEX ${idx.name} ON ${idx.table} ${idx.columns}`;
      console.log('   - Creando índice:', create);
      await queryAsync(create);
    }
  }
}

async function insertDefaultUsers() {
  console.log('→ Insertando usuarios por defecto (ignorar si existen)...');
  const sql = `
    INSERT IGNORE INTO usuarios (username, password, nombre, email, rol) VALUES
    ('admin', '$2b$10$rOvHIKSyZhNBxNvmQfWzKOQGQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ', 'Administrador', 'admin@dtmjacaltenango.com', 'admin'),
    ('tecnico1', '$2b$10$rOvHIKSyZhNBxNvmQfWzKOQGQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ', 'Técnico Principal', 'tecnico1@dtmjacaltenango.com', 'tecnico'),
    ('usuario1', '$2b$10$rOvHIKSyZhNBxNvmQfWzKOQGQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ', 'Usuario Demo', 'usuario1@dtmjacaltenango.com', 'usuario')
  `;
  await queryAsync(sql);
}

async function ensureTrigger(name, createSql) {
  const rows = await queryAsync(`
    SELECT TRIGGER_NAME FROM information_schema.TRIGGERS 
    WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = ?
  `, [name]);
  if (rows.length === 0) {
    console.log(`→ Creando trigger ${name}...`);
    await queryAsync(createSql);
  } else {
    console.log(`✓ Trigger ${name} ya existe`);
  }
}

async function ensureTriggers() {
  const insertTrigger = `
    CREATE TRIGGER tickets_audit_insert
    AFTER INSERT ON tickets
    FOR EACH ROW
    BEGIN
      INSERT INTO auditoria (tabla_afectada, id_registro, accion, datos_nuevos, usuario_id)
      VALUES (
        'tickets', NEW.id, 'CREATE',
        JSON_OBJECT(
          'cliente', NEW.cliente,
          'direccion', NEW.direccion,
          'telefono', NEW.telefono,
          'descripcion', NEW.descripcion,
          'tipoSoporte', NEW.tipoSoporte,
          'estado', NEW.estado
        ),
        NEW.creado_por
      );
    END
  `;

  const updateTrigger = `
    CREATE TRIGGER tickets_audit_update
    AFTER UPDATE ON tickets
    FOR EACH ROW
    BEGIN
      INSERT INTO auditoria (tabla_afectada, id_registro, accion, datos_anteriores, datos_nuevos, usuario_id)
      VALUES (
        'tickets', NEW.id, 'UPDATE',
        JSON_OBJECT(
          'cliente', OLD.cliente,
          'direccion', OLD.direccion,
          'telefono', OLD.telefono,
          'descripcion', OLD.descripcion,
          'tipoSoporte', OLD.tipoSoporte,
          'estado', OLD.estado
        ),
        JSON_OBJECT(
          'cliente', NEW.cliente,
          'direccion', NEW.direccion,
          'telefono', NEW.telefono,
          'descripcion', NEW.descripcion,
          'tipoSoporte', NEW.tipoSoporte,
          'estado', NEW.estado
        ),
        NEW.modificado_por
      );
    END
  `;

  const deleteTrigger = `
    CREATE TRIGGER tickets_audit_delete
    AFTER DELETE ON tickets
    FOR EACH ROW
    BEGIN
      INSERT INTO auditoria (tabla_afectada, id_registro, accion, datos_anteriores, usuario_id)
      VALUES (
        'tickets', OLD.id, 'DELETE',
        JSON_OBJECT(
          'cliente', OLD.cliente,
          'direccion', OLD.direccion,
          'telefono', OLD.telefono,
          'descripcion', OLD.descripcion,
          'tipoSoporte', OLD.tipoSoporte,
          'estado', OLD.estado
        ),
        OLD.modificado_por
      );
    END
  `;

  await ensureTrigger('tickets_audit_insert', insertTrigger);
  await ensureTrigger('tickets_audit_update', updateTrigger);
  await ensureTrigger('tickets_audit_delete', deleteTrigger);
}

async function main() {
  try {
    console.log('Conectando a MySQL...');
    await queryAsync('SELECT 1');
    console.log('✓ Conectado');

    await ensureUsuariosTable();
    await ensureAuditoriaTable();
    await ensureTicketsColumns();
    await ensureIndices();
    await insertDefaultUsers();
    await ensureTriggers();

    console.log('\n✅ Migración completada.');
  } catch (err) {
    console.error('❌ Error en migración:', err);
  } finally {
    db.end();
  }
}

main();
