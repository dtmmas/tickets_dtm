const mysql = require('mysql2');
const bcrypt = require('bcrypt');

// Configuración de la base de datos
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'huberto051986',
  database: 'ticket_system'
});

// Función para crear usuarios de prueba
async function createTestUsers() {
  try {
    // Crear tabla de usuarios si no existe
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(100),
        rol ENUM('admin', 'tecnico', 'usuario') DEFAULT 'usuario',
        activo BOOLEAN DEFAULT true,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    db.query(createUsersTable, (err) => {
      if (err) {
        console.error('Error creando tabla usuarios:', err);
        return;
      }
      console.log('Tabla usuarios creada o ya existe');
    });

    // Usuarios de prueba
    const testUsers = [
      {
        username: 'admin',
        password: 'admin123',
        nombre: 'Administrador',
        email: 'admin@ticketsystem.com',
        rol: 'admin'
      },
      {
        username: 'user1',
        password: 'user123',
        nombre: 'Usuario Uno',
        email: 'user1@ticketsystem.com',
        rol: 'usuario'
      },
      {
        username: 'user2',
        password: 'user123',
        nombre: 'Usuario Dos',
        email: 'user2@ticketsystem.com',
        rol: 'usuario'
      }
    ];

    // Insertar usuarios
    for (const user of testUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      const insertQuery = `
        INSERT IGNORE INTO usuarios (username, password, nombre, email, rol)
        VALUES (?, ?, ?, ?, ?)
      `;

      db.query(insertQuery, [
        user.username,
        hashedPassword,
        user.nombre,
        user.email,
        user.rol
      ], (err, result) => {
        if (err) {
          console.error(`Error insertando usuario ${user.username}:`, err);
        } else if (result.affectedRows > 0) {
          console.log(`Usuario ${user.username} creado exitosamente`);
        } else {
          console.log(`Usuario ${user.username} ya existe`);
        }
      });
    }

    // Cerrar conexión después de un breve delay
    setTimeout(() => {
      db.end();
      console.log('Proceso completado. Conexión cerrada.');
    }, 2000);

  } catch (error) {
    console.error('Error en el proceso:', error);
    db.end();
  }
}

// Ejecutar el script
createTestUsers();