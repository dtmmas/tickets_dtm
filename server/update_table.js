const mysql = require('mysql2');
const { dbConfig } = require('./env');

// Configuración de la base de datos
const db = mysql.createConnection(dbConfig);

// Función para actualizar la estructura de la tabla tickets
async function updateTicketsTable() {
  try {
    console.log('Conectando a la base de datos...');
    
    // Verificar estructura actual de la tabla
    db.query('DESCRIBE tickets', (err, results) => {
      if (err) {
        console.error('Error al describir la tabla:', err);
        return;
      }
      
      console.log('Estructura actual de la tabla tickets:');
      console.table(results);
      
      // Verificar si las columnas ya existen
      const columns = results.map(row => row.Field);
      const needsCreatedBy = !columns.includes('creado_por');
      const needsModifiedBy = !columns.includes('modificado_por');
      const needsPrecio = !columns.includes('precio');
      const needsCobroAplica = !columns.includes('cobro_aplica');
      const needsPago = !columns.includes('pago');
      
      if (needsCreatedBy || needsModifiedBy || needsPrecio || needsCobroAplica || needsPago) {
        console.log('Actualizando estructura de la tabla...');
        
        let alterQueries = [];
        
        if (needsCreatedBy) {
          alterQueries.push('ALTER TABLE tickets ADD COLUMN creado_por INT DEFAULT NULL');
        }
        
        if (needsModifiedBy) {
          alterQueries.push('ALTER TABLE tickets ADD COLUMN modificado_por INT DEFAULT NULL');
        }

        if (needsPrecio) {
          alterQueries.push('ALTER TABLE tickets ADD COLUMN precio DECIMAL(10,2) DEFAULT NULL');
        }

        if (needsCobroAplica) {
          alterQueries.push('ALTER TABLE tickets ADD COLUMN cobro_aplica BOOLEAN DEFAULT FALSE');
        }

        if (needsPago) {
          alterQueries.push('ALTER TABLE tickets ADD COLUMN pago DECIMAL(10,2) DEFAULT NULL');
        }
        
        // Ejecutar las consultas de alteración
        alterQueries.forEach((query, index) => {
          db.query(query, (err, result) => {
            if (err) {
              console.error(`Error ejecutando consulta ${index + 1}:`, err);
            } else {
              console.log(`✅ Consulta ${index + 1} ejecutada exitosamente:`, query);
            }
            
            // Si es la última consulta, verificar la estructura final
            if (index === alterQueries.length - 1) {
              setTimeout(() => {
                db.query('DESCRIBE tickets', (err, finalResults) => {
                  if (err) {
                    console.error('Error al verificar estructura final:', err);
                  } else {
                    console.log('\n✅ Estructura final de la tabla tickets:');
                    console.table(finalResults);
                  }
                  db.end();
                  console.log('Proceso completado. Conexión cerrada.');
                });
              }, 1000);
            }
          });
        });
      } else {
        console.log('✅ La tabla ya tiene todas las columnas necesarias.');
        db.end();
        console.log('Proceso completado. Conexión cerrada.');
      }
    });

  } catch (error) {
    console.error('Error en el proceso:', error);
    db.end();
  }
}

// Ejecutar el script
updateTicketsTable();
