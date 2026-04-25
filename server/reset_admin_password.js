const mysql = require('mysql2');
const bcrypt = require('bcrypt');

// Configuración de conexión (ajusta si tu .env difiere)
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'huberto051986',
  database: process.env.DB_NAME || 'ticket_system'
});

async function run() {
  try {
    const newPassword = process.env.NEW_ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(newPassword, 10);

    connection.query(
      'UPDATE usuarios SET password = ? WHERE username = ? LIMIT 1',
      [hash, 'admin'],
      (err, result) => {
        if (err) {
          console.error('Error actualizando contraseña de admin:', err);
          process.exit(1);
        }
        if (result.affectedRows === 0) {
          console.log('Usuario admin no existe.');
        } else {
          console.log('Contraseña de admin actualizada correctamente.');
        }
        connection.end();
      }
    );
  } catch (e) {
    console.error('Error generando hash:', e);
    connection.end();
    process.exit(1);
  }
}

run();