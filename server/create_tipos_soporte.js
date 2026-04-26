const mysql = require('mysql2');
const { dbConfig } = require('./env');

// Configuración de la base de datos
const db = mysql.createConnection(dbConfig);

// Función para crear la tabla tipos_soporte y poblarla con datos
async function createTiposSoporteTable() {
  try {
    console.log('Conectando a la base de datos...');
    
    // Crear tabla tipos_soporte si no existe
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS tipos_soporte (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL UNIQUE,
        descripcion TEXT,
        activo BOOLEAN DEFAULT true,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    db.query(createTableQuery, (err) => {
      if (err) {
        console.error('Error creando tabla tipos_soporte:', err);
        return;
      }
      console.log('✅ Tabla tipos_soporte creada o ya existe');
      
      // Datos predefinidos para tipos de soporte
      const tiposSoporte = [
        {
          nombre: 'Soporte Técnico',
          descripcion: 'Problemas técnicos con hardware o software'
        },
        {
          nombre: 'Consulta General',
          descripcion: 'Consultas generales sobre productos o servicios'
        },
        {
          nombre: 'Facturación',
          descripcion: 'Problemas relacionados con facturación y pagos'
        },
        {
          nombre: 'Instalación',
          descripcion: 'Solicitudes de instalación de equipos o software'
        },
        {
          nombre: 'Mantenimiento',
          descripcion: 'Solicitudes de mantenimiento preventivo o correctivo'
        },
        {
          nombre: 'Capacitación',
          descripcion: 'Solicitudes de capacitación y entrenamiento'
        },
        {
          nombre: 'Reclamo',
          descripcion: 'Reclamos sobre productos o servicios'
        },
        {
          nombre: 'Configuración',
          descripcion: 'Configuración de sistemas y equipos'
        }
      ];

      // Insertar tipos de soporte
      let insertedCount = 0;
      tiposSoporte.forEach((tipo, index) => {
        const insertQuery = `
          INSERT IGNORE INTO tipos_soporte (nombre, descripcion)
          VALUES (?, ?)
        `;

        db.query(insertQuery, [tipo.nombre, tipo.descripcion], (err, result) => {
          if (err) {
            console.error(`Error insertando tipo ${tipo.nombre}:`, err);
          } else if (result.affectedRows > 0) {
            console.log(`✅ Tipo de soporte "${tipo.nombre}" creado exitosamente`);
          } else {
            console.log(`ℹ️  Tipo de soporte "${tipo.nombre}" ya existe`);
          }
          
          insertedCount++;
          
          // Si es el último tipo, mostrar resumen y cerrar conexión
          if (insertedCount === tiposSoporte.length) {
            setTimeout(() => {
              db.query('SELECT * FROM tipos_soporte ORDER BY nombre', (err, results) => {
                if (err) {
                  console.error('Error consultando tipos de soporte:', err);
                } else {
                  console.log('\n📋 Tipos de soporte disponibles:');
                  console.table(results);
                }
                db.end();
                console.log('\n✅ Proceso completado. Conexión cerrada.');
              });
            }, 1000);
          }
        });
      });
    });

  } catch (error) {
    console.error('Error en el proceso:', error);
    db.end();
  }
}

// Ejecutar el script
createTiposSoporteTable();
