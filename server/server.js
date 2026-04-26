const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { appBaseUrl, clientUrls, jwtSecret, poolConfig, port } = require('./env');
const {
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLES,
  normalizePermissions,
  normalizeRoleName
} = require('./permissions');

const app = express();
app.set('trust proxy', 1);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (clientUrls.includes(origin)) return true;

  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isPrivateIpv4 =
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);

    return isLocalhost || isPrivateIpv4;
  } catch (_) {
    return false;
  }
};

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true
}));
app.use(bodyParser.json());

// Static para logos/subidas
const uploadsDir = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.warn('No se pudo crear el directorio de uploads:', e);
}
app.use('/uploads', express.static(uploadsDir));

const getPublicBaseUrl = (req) => {
  if (appBaseUrl) return appBaseUrl;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = req.get('host');
  return host ? `${protocol}://${host}` : `http://localhost:${port}`;
};

const buildPublicUrl = (req, relativePath) => {
  const normalizedPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${getPublicBaseUrl(req)}${normalizedPath}`;
};

// Configuración de empresa (logo y textos de login)
const configPath = path.join(__dirname, 'config.json');
const defaultConfig = {
  empresaNombre: 'DTM Jacaltenango',
  loginSubtitle: 'Sistema de Tickets de Soporte DTM Jacaltenango',
};
function readConfig() {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(raw);
    return { ...defaultConfig, ...cfg };
  } catch (_) {
    return { ...defaultConfig };
  }
}
function writeConfig(partial) {
  const current = readConfig();
  const next = { ...current, ...partial };
  try {
    fs.writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf8');
  } catch (e) {
    console.error('Error al escribir config.json:', e);
  }
  return next;
}

// Middleware para verificar JWT
const verifyToken = async (req, res, next) => {
  const token = req.headers['authorization'];
  
  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }
  
  // Remover 'Bearer ' del token
  const actualToken = token.startsWith('Bearer ') ? token.slice(7) : token;
  
  try {
    const decoded = jwt.verify(actualToken, jwtSecret);
    const userRow = await querySingle(
      'SELECT id, username, nombre, email, rol, activo FROM usuarios WHERE id = ? AND activo = TRUE LIMIT 1',
      [decoded.id]
    );
    if (!userRow) {
      return res.status(401).json({ error: 'Usuario no disponible' });
    }
    req.user = await buildAuthUser(userRow);
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido' });
  }
};

// Configuración de la conexión a MySQL (Pool)
const db = mysql.createPool(poolConfig);
const dbPromise = db.promise();

const querySingle = async (sql, params = []) => {
  const [rows] = await dbPromise.query(sql, params);
  return rows && rows[0] ? rows[0] : null;
};

const queryRows = async (sql, params = []) => {
  const [rows] = await dbPromise.query(sql, params);
  return rows || [];
};

const hasPermission = (user, permission) => {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes(permission);
};

const requirePermission = (permission) => (req, res, next) => {
  if (!hasPermission(req.user, permission)) {
    return res.status(403).json({ error: 'Permisos insuficientes' });
  }
  next();
};

const getLegacyRolePermissions = (roleName) => {
  const normalized = normalizeRoleName(roleName);
  return DEFAULT_ROLE_PERMISSIONS[normalized] || [];
};

const getRolePermissionsFromValue = (value) => {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return normalizePermissions(parsed);
  } catch (_) {
    return [];
  }
};

const loadRoleByName = async (roleName) => {
  const normalizedName = normalizeRoleName(roleName);
  if (!normalizedName) return null;
  const role = await querySingle(
    'SELECT id, nombre, descripcion, permisos, activo, sistema, fecha_creacion, fecha_actualizacion FROM roles WHERE nombre = ? LIMIT 1',
    [normalizedName]
  );
  if (!role) return null;
  return {
    ...role,
    nombre: normalizeRoleName(role.nombre),
    permisos: getRolePermissionsFromValue(role.permisos)
  };
};

const buildAuthUser = async (userRow) => {
  const roleName = normalizeRoleName(userRow?.rol);
  const role = await loadRoleByName(roleName);
  const permissions = role
    ? (role.activo ? role.permisos : [])
    : getLegacyRolePermissions(roleName);

  return {
    id: userRow.id,
    username: userRow.username,
    nombre: userRow.nombre,
    email: userRow.email,
    rol: roleName,
    permissions,
    role: role
      ? {
          id: role.id,
          nombre: role.nombre,
          descripcion: role.descripcion,
          activo: !!role.activo,
          sistema: !!role.sistema
        }
      : {
          id: null,
          nombre: roleName,
          descripcion: '',
          activo: true,
          sistema: ['admin', 'tecnico', 'usuario'].includes(roleName)
        }
  };
};

// Probar conexión inicial y crear tablas
db.getConnection((err, connection) => {
  if (err) {
    console.error('Error al conectar a MySQL:', err);
    return;
  }
  console.log('Conectado a MySQL');
  connection.release(); // Liberar conexión inmediatamente

  // Crear tabla de tickets si no existe
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cliente VARCHAR(100) NOT NULL,
      direccion VARCHAR(200) NOT NULL,
      telefono VARCHAR(20) NOT NULL,
      descripcion TEXT NOT NULL,
      tipoSoporte VARCHAR(50) NOT NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      precio DECIMAL(10,2) DEFAULT NULL,
      cobro_aplica BOOLEAN DEFAULT FALSE,
      pago DECIMAL(10,2) DEFAULT NULL,
      fechaProgramada DATETIME DEFAULT NULL,
      creado_por INT DEFAULT NULL,
      modificado_por INT DEFAULT NULL,
      fechaCreacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fechaActualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;
  
  db.query(createTableQuery, (err) => {
    if (err) {
      console.error('Error al crear tabla:', err);
    } else {
      console.log('Tabla de tickets creada o ya existente');
      // Asegurar columna motivo_cancelacion para gestionar razón de cancelación
      const colCheck = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'motivo_cancelacion'`;
      db.query(colCheck, (cErr, cRows) => {
        if (cErr) {
          console.error('Error al verificar columna motivo_cancelacion:', cErr);
        } else if (!Array.isArray(cRows) || cRows.length === 0) {
          const alterQuery = `ALTER TABLE tickets ADD COLUMN motivo_cancelacion VARCHAR(255) DEFAULT NULL`;
          db.query(alterQuery, (aErr) => {
            if (aErr) {
              console.error('Error al agregar columna motivo_cancelacion:', aErr);
            } else {
              console.log('Columna motivo_cancelacion agregada a tickets');
            }
          });
        }
      });
      // Asegurar columna fechaProgramada para agenda/calendario
      const colCheckProg = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'fechaProgramada'`;
      db.query(colCheckProg, (cpErr, cpRows) => {
        if (cpErr) {
          console.error('Error al verificar columna fechaProgramada:', cpErr);
        } else if (!Array.isArray(cpRows) || cpRows.length === 0) {
          const alterQuery = `ALTER TABLE tickets ADD COLUMN fechaProgramada DATETIME DEFAULT NULL`;
          db.query(alterQuery, (aErr) => {
            if (aErr) {
              console.error('Error al agregar columna fechaProgramada:', aErr);
            } else {
              console.log('Columna fechaProgramada agregada a tickets');
            }
          });
        }
      });
    }
  });

  // Crear tabla tipos_soporte si no existe
  const createTiposSoporteQuery = `
    CREATE TABLE IF NOT EXISTS tipos_soporte (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL UNIQUE,
      descripcion TEXT,
      activo BOOLEAN DEFAULT TRUE,
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.query(createTiposSoporteQuery, (err) => {
    if (err) {
      console.error('Error al crear tabla tipos_soporte:', err);
    } else {
      console.log('Tabla tipos_soporte creada o ya existente');
    }
  });

  // Crear tabla de configuración de empresa si no existe y asegurar fila única id=1
  const createConfigEmpresaQuery = `
    CREATE TABLE IF NOT EXISTS config_empresa (
      id INT PRIMARY KEY,
      empresa_nombre VARCHAR(200),
      login_subtitle VARCHAR(200),
      logo_path VARCHAR(255),
      fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;
  db.query(createConfigEmpresaQuery, (err) => {
    if (err) {
      console.error('Error al crear tabla config_empresa:', err);
    } else {
      console.log('Tabla config_empresa creada o ya existente');
      db.query('SELECT COUNT(*) AS c FROM config_empresa WHERE id = 1', (selErr, rows) => {
        if (selErr) {
          console.error('Error al verificar fila de configuración:', selErr);
        } else {
          const count = rows && rows[0] ? rows[0].c : 0;
          if (count === 0) {
            const cfg = readConfig();
            const insertSql = 'INSERT INTO config_empresa (id, empresa_nombre, login_subtitle, logo_path) VALUES (1, ?, ?, NULL)';
            db.query(insertSql, [cfg.empresaNombre || 'DTM Jacaltenango', cfg.loginSubtitle || 'Sistema de Tickets de Soporte DTM Jacaltenango'], (insErr) => {
              if (insErr) {
                console.error('Error al insertar configuración inicial:', insErr);
              } else {
                console.log('Configuración inicial insertada en config_empresa');
              }
            });
          }
        }
      });
    }
  });

  // Crear tabla de roles y permisos
  const createRolesTable = `
    CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(50) NOT NULL UNIQUE,
      descripcion VARCHAR(255) DEFAULT '',
      permisos JSON NOT NULL,
      activo BOOLEAN DEFAULT TRUE,
      sistema BOOLEAN DEFAULT FALSE,
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;
  db.query(createRolesTable, (err) => {
    if (err) {
      console.error('Error al crear tabla roles:', err);
    } else {
      console.log('Tabla roles creada o ya existente');
      DEFAULT_ROLES.forEach((role) => {
        const sql = `
          INSERT INTO roles (nombre, descripcion, permisos, activo, sistema)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            descripcion = VALUES(descripcion),
            permisos = IF(sistema = TRUE, VALUES(permisos), permisos),
            activo = IF(sistema = TRUE, VALUES(activo), activo),
            sistema = VALUES(sistema)
        `;
        db.query(
          sql,
          [role.nombre, role.descripcion, JSON.stringify(role.permisos), role.activo, role.sistema],
          (seedErr) => {
            if (seedErr) {
              console.error(`Error al asegurar rol ${role.nombre}:`, seedErr);
            }
          }
        );
      });
    }
  });

  // Crear tabla de usuarios si no existe (asegurar que exista para producción)
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      nombre VARCHAR(100) NOT NULL,
      email VARCHAR(100),
      rol ENUM('admin', 'tecnico', 'usuario') DEFAULT 'usuario',
      activo BOOLEAN DEFAULT true,
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;
  db.query(createUsersTable, (err) => {
    if (err) {
      console.error('Error al crear tabla usuarios:', err);
    } else {
      console.log('Tabla usuarios creada o ya existente');
      db.query(
        "ALTER TABLE usuarios MODIFY COLUMN rol VARCHAR(50) NOT NULL DEFAULT 'usuario'",
        (alterErr) => {
          if (alterErr) {
            console.error('Error al actualizar columna rol de usuarios:', alterErr);
          }
        }
      );
      // Verificar si existe el usuario admin por defecto
      db.query('SELECT COUNT(*) as count FROM usuarios', async (cErr, cRows) => {
        if (!cErr && cRows && cRows[0].count === 0) {
          console.log('Creando usuario admin por defecto...');
          try {
            const hashed = await bcrypt.hash('admin123', 10);
            db.query('INSERT INTO usuarios (username, password, nombre, email, rol, activo) VALUES (?, ?, ?, ?, ?, ?)',
              ['admin', hashed, 'Administrador', 'admin@ticketsystem.com', 'admin', true],
              (iErr) => {
                if (iErr) console.error('Error creando admin por defecto:', iErr);
                else console.log('Usuario admin creado exitosamente');
              }
            );
          } catch (e) {
            console.error('Error hasheando password admin:', e);
          }
        }
      });
    }
  });
});

// Rutas API

// Config pública para pantalla de login (no requiere token)
app.get('/api/config', (req, res) => {
  db.query('SELECT empresa_nombre, login_subtitle, logo_path FROM config_empresa WHERE id = 1', (err, rows) => {
    if (err) {
      console.error('Error al leer configuración desde BD, usando archivo:', err);
      const cfg = readConfig();
      const logoCandidates = ['company-logo.png', 'company-logo.jpg', 'company-logo.jpeg'];
      let logoUrl = '';
      for (const file of logoCandidates) {
        const full = path.join(uploadsDir, file);
        try { if (fs.existsSync(full)) { logoUrl = buildPublicUrl(req, `/uploads/${file}`); break; } } catch (_) {}
      }
      return res.json({ empresaNombre: cfg.empresaNombre, loginSubtitle: cfg.loginSubtitle, logoUrl });
    }
    const row = rows && rows[0] ? rows[0] : null;
    const empresaNombre = row?.empresa_nombre ?? readConfig().empresaNombre;
    const loginSubtitle = row?.login_subtitle ?? readConfig().loginSubtitle;
    const logoPath = row?.logo_path || '';
    const logoUrl = logoPath ? buildPublicUrl(req, `/uploads/${path.basename(logoPath)}`) : '';
    res.json({ empresaNombre, loginSubtitle, logoUrl });
  });
});

// Actualizar textos de login y nombre de empresa y opcionalmente logo
app.put('/api/config', verifyToken, requirePermission('settings.manage'), (req, res) => {
  const { empresaNombre = '', loginSubtitle = '', dataUrl } = req.body || {};

  // Guardar logo si viene incluido
  let newLogoFilename = '';
  if (dataUrl) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return res.status(400).json({ error: 'dataUrl inválido' });
    }
    const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/i);
    if (!match) {
      return res.status(400).json({ error: 'Formato de imagen no soportado. Use PNG o JPG.' });
    }
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    const ext = match[2].toLowerCase() === 'png' ? 'png' : 'jpg';
    const base64 = match[3];
    let buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch (_) {
      return res.status(400).json({ error: 'Contenido base64 inválido' });
    }
    if (buffer.length > MAX_SIZE) {
      return res.status(413).json({ error: 'La imagen excede el límite de 2MB' });
    }

    // Eliminar logo anterior si existe
    db.query('SELECT logo_path FROM config_empresa WHERE id = 1', (selErr, rows) => {
      if (!selErr && rows && rows[0] && rows[0].logo_path) {
        const prevPath = path.join(uploadsDir, path.basename(rows[0].logo_path));
        try {
          if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath);
        } catch (e) {
          console.warn('No se pudo eliminar logo anterior:', e);
        }
      }
      // Guardar nuevo logo
      newLogoFilename = `company-logo.${ext}`;
      const fullPath = path.join(uploadsDir, newLogoFilename);
      try {
        fs.writeFileSync(fullPath, buffer);
      } catch (e) {
        console.error('Error al guardar logo:', e);
        return res.status(500).json({ error: 'No se pudo guardar el logo' });
      }

      // Upsert configuración con nuevo logo
      const upsertSql = `INSERT INTO config_empresa (id, empresa_nombre, login_subtitle, logo_path)
                         VALUES (1, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE empresa_nombre = VALUES(empresa_nombre), login_subtitle = VALUES(login_subtitle), logo_path = VALUES(logo_path)`;
      db.query(upsertSql, [empresaNombre, loginSubtitle, newLogoFilename], (updErr) => {
        if (updErr) {
          console.error('Error al guardar configuración en BD:', updErr);
          return res.status(500).json({ error: 'Error al guardar configuración' });
        }
        const cfg = writeConfig({ empresaNombre, loginSubtitle });
        const logoUrl = buildPublicUrl(req, `/uploads/${newLogoFilename}`);
        res.json({ empresaNombre: cfg.empresaNombre, loginSubtitle: cfg.loginSubtitle, logoUrl });
      });
    });
    return; // Evitar continuar flujo síncrono
  }

  // Upsert sin cambiar logo
  const upsertSql = `INSERT INTO config_empresa (id, empresa_nombre, login_subtitle, logo_path)
                     VALUES (1, ?, ?, (SELECT logo_path FROM config_empresa WHERE id = 1))
                     ON DUPLICATE KEY UPDATE empresa_nombre = VALUES(empresa_nombre), login_subtitle = VALUES(login_subtitle)`;
  db.query(upsertSql, [empresaNombre, loginSubtitle], (updErr) => {
    if (updErr) {
      console.error('Error al guardar configuración en BD:', updErr);
      return res.status(500).json({ error: 'Error al guardar configuración' });
    }
    const cfg = writeConfig({ empresaNombre, loginSubtitle });
    db.query('SELECT logo_path FROM config_empresa WHERE id = 1', (lpErr, rows) => {
      const logoPath = (!lpErr && rows && rows[0] && rows[0].logo_path) ? rows[0].logo_path : '';
      const logoUrl = logoPath ? buildPublicUrl(req, `/uploads/${path.basename(logoPath)}`) : '';
      res.json({ empresaNombre: cfg.empresaNombre, loginSubtitle: cfg.loginSubtitle, logoUrl });
    });
  });
});

// Subir logo de empresa vía data URL
app.post('/api/config/logo', verifyToken, requirePermission('settings.manage'), (req, res) => {
  const { dataUrl } = req.body || {};
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return res.status(400).json({ error: 'dataUrl inválido' });
  }
  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/i);
  if (!match) {
    return res.status(400).json({ error: 'Formato de imagen no soportado. Use PNG o JPG.' });
  }
  const MAX_SIZE = 2 * 1024 * 1024; // 2MB
  const ext = match[2].toLowerCase() === 'png' ? 'png' : 'jpg';
  const base64 = match[3];
  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch (_) {
    return res.status(400).json({ error: 'Contenido base64 inválido' });
  }
  if (buffer.length > MAX_SIZE) {
    return res.status(413).json({ error: 'La imagen excede el límite de 2MB' });
  }
  // Borrar posibles archivos anteriores
  try {
    ['company-logo.png', 'company-logo.jpg', 'company-logo.jpeg'].forEach(f => {
      const p = path.join(uploadsDir, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  } catch (e) {
    console.warn('No se pudieron limpiar logos anteriores:', e);
  }
  const filename = `company-logo.${ext}`;
  const fullPath = path.join(uploadsDir, filename);
  try {
    fs.writeFileSync(fullPath, buffer);
  } catch (e) {
    console.error('Error al guardar logo:', e);
    return res.status(500).json({ error: 'No se pudo guardar el logo' });
  }
  const cfg = writeConfig({});
  const logoUrl = buildPublicUrl(req, `/uploads/${filename}`);
  res.json({ ...cfg, logoUrl });
});

// Catálogo de permisos
app.get('/api/permissions', verifyToken, requirePermission('roles.manage'), (req, res) => {
  res.json({ groups: PERMISSION_GROUPS, all: ALL_PERMISSIONS });
});

// Roles disponibles
app.get('/api/roles', verifyToken, requirePermission('users.manage'), async (req, res) => {
  try {
    const includeInactive = String(req.query.include_inactivos || 'true') === 'true';
    const params = [];
    let where = '';
    if (!includeInactive) {
      where = 'WHERE activo = TRUE';
    }
    const roles = await queryRows(
      `SELECT id, nombre, descripcion, permisos, activo, sistema, fecha_creacion, fecha_actualizacion
       FROM roles ${where} ORDER BY sistema DESC, nombre ASC`,
      params
    );
    res.json(
      roles.map((role) => ({
        ...role,
        nombre: normalizeRoleName(role.nombre),
        permisos: getRolePermissionsFromValue(role.permisos),
        activo: !!role.activo,
        sistema: !!role.sistema
      }))
    );
  } catch (error) {
    console.error('Error al listar roles:', error);
    res.status(500).json({ error: 'Error al listar roles' });
  }
});

app.post('/api/roles', verifyToken, requirePermission('roles.manage'), async (req, res) => {
  try {
    const nombre = normalizeRoleName(req.body?.nombre);
    const descripcion = String(req.body?.descripcion || '').trim();
    const permisos = normalizePermissions(req.body?.permisos);
    const activo = req.body?.activo !== false;
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del rol es obligatorio' });
    }
    if (permisos.length === 0) {
      return res.status(400).json({ error: 'Debe seleccionar al menos un permiso' });
    }
    const [result] = await dbPromise.query(
      'INSERT INTO roles (nombre, descripcion, permisos, activo, sistema) VALUES (?, ?, ?, ?, FALSE)',
      [nombre, descripcion, JSON.stringify(permisos), activo]
    );
    const created = await loadRoleByName(nombre);
    res.status(201).json(created || { id: result.insertId, nombre, descripcion, permisos, activo, sistema: false });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un rol con ese nombre' });
    }
    console.error('Error al crear rol:', error);
    res.status(500).json({ error: 'Error al crear rol' });
  }
});

app.put('/api/roles/:id', verifyToken, requirePermission('roles.manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const currentRole = await querySingle('SELECT * FROM roles WHERE id = ?', [id]);
    if (!currentRole) {
      return res.status(404).json({ error: 'Rol no encontrado' });
    }
    const nombre = normalizeRoleName(req.body?.nombre || currentRole.nombre);
    const descripcion = String(req.body?.descripcion ?? currentRole.descripcion ?? '').trim();
    const permisos = normalizePermissions(req.body?.permisos);
    const activo = req.body?.activo !== false;
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del rol es obligatorio' });
    }
    if (permisos.length === 0) {
      return res.status(400).json({ error: 'Debe seleccionar al menos un permiso' });
    }
    if (currentRole.sistema && !activo) {
      return res.status(400).json({ error: 'No se puede desactivar un rol del sistema' });
    }
    if (currentRole.sistema && nombre !== normalizeRoleName(currentRole.nombre)) {
      return res.status(400).json({ error: 'No se puede renombrar un rol del sistema' });
    }
    await dbPromise.query(
      'UPDATE roles SET nombre = ?, descripcion = ?, permisos = ?, activo = ? WHERE id = ?',
      [nombre, descripcion, JSON.stringify(permisos), activo, id]
    );
    if (normalizeRoleName(currentRole.nombre) !== nombre) {
      await dbPromise.query('UPDATE usuarios SET rol = ? WHERE rol = ?', [nombre, normalizeRoleName(currentRole.nombre)]);
    }
    const updated = await loadRoleByName(nombre);
    res.json(updated);
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un rol con ese nombre' });
    }
    console.error('Error al actualizar rol:', error);
    res.status(500).json({ error: 'Error al actualizar rol' });
  }
});

// Gestión de usuarios
// Listar usuarios con búsqueda y paginación básica
app.get('/api/users', verifyToken, requirePermission('users.manage'), (req, res) => {
  const { search = '', include_inactivos = 'true', page = 1, limit = 50 } = req.query;
  const numericLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
  const numericPage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (numericPage - 1) * numericLimit;
  const where = [];
  const params = [];
  if (include_inactivos !== 'true') where.push('u.activo = TRUE');
  if (search && search.trim()) {
    where.push('(u.username LIKE ? OR u.nombre LIKE ? OR u.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countSql = `SELECT COUNT(*) AS total FROM usuarios u ${whereClause}`;
  const listSql = `
    SELECT u.id, u.username, u.nombre, u.email, u.rol, u.activo, u.fecha_creacion, u.fecha_actualizacion,
           r.id AS role_id, r.descripcion AS role_descripcion, r.activo AS role_activo, r.sistema AS role_sistema
    FROM usuarios u
    LEFT JOIN roles r ON r.nombre = u.rol
    ${whereClause}
    ORDER BY u.fecha_creacion DESC
    LIMIT ? OFFSET ?
  `;
  db.query(countSql, params, (cErr, cRows) => {
    if (cErr) {
      console.error('Error al contar usuarios:', cErr);
      return res.status(500).json({ error: 'Error al obtener conteo' });
    }
    const total = cRows[0]?.total || 0;
    db.query(listSql, [...params, numericLimit, offset], (err, rows) => {
      if (err) {
        console.error('Error al listar usuarios:', err);
        return res.status(500).json({ error: 'Error al listar usuarios' });
      }
      res.set('Access-Control-Expose-Headers', 'X-Total-Count');
      res.set('X-Total-Count', String(total));
      res.json({
        items: rows.map((row) => ({
          ...row,
          activo: !!row.activo,
          role_activo: row.role_activo == null ? null : !!row.role_activo,
          role_sistema: row.role_sistema == null ? null : !!row.role_sistema
        })),
        meta: { total, page: numericPage, limit: numericLimit }
      });
    });
  });
});

// Crear usuario
app.post('/api/users', verifyToken, requirePermission('users.manage'), async (req, res) => {
  const { username, password, nombre, email, rol = 'usuario', activo = true } = req.body || {};
  if (!username || !password || !nombre || !email) {
    return res.status(400).json({ error: 'username, password, nombre y email son obligatorios' });
  }
  try {
    const roleNorm = normalizeRoleName(rol);
    const role = await loadRoleByName(roleNorm);
    if (!role || !role.activo) {
      return res.status(400).json({ error: 'Rol inválido o inactivo' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const insert = `INSERT INTO usuarios (username, password, nombre, email, rol, activo) VALUES (?, ?, ?, ?, ?, ?)`;
    db.query(insert, [username, hashed, nombre, email, roleNorm, !!activo], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'Username o email ya existe' });
        }
        console.error('Error al crear usuario:', err);
        return res.status(500).json({ error: 'Error al crear usuario: ' + err.message });
      }
      db.query('SELECT id, username, nombre, email, rol, activo, fecha_creacion, fecha_actualizacion FROM usuarios WHERE id = ?', [result.insertId], (gErr, rows) => {
        if (gErr) {
          console.error('Error al obtener usuario creado:', gErr);
          return res.status(500).json({ error: 'Usuario creado pero error al obtener datos: ' + gErr.message });
        }
        res.status(201).json(rows[0]);
      });
    });
  } catch (e) {
    console.error('Error al hashear contraseña:', e);
    return res.status(500).json({ error: 'Error interno (hash): ' + e.message });
  }
});

// Actualizar datos de usuario (no contraseña)
app.put('/api/users/:id', verifyToken, requirePermission('users.manage'), async (req, res) => {
  const { id } = req.params;
  const { nombre, email, rol, activo } = req.body || {};
  if (!nombre || !email) {
    return res.status(400).json({ error: 'nombre y email son obligatorios' });
  }
  try {
    const roleNorm = normalizeRoleName(rol || 'usuario');
    const role = await loadRoleByName(roleNorm);
    if (!role || !role.activo) {
      return res.status(400).json({ error: 'Rol inválido o inactivo' });
    }
    const update = `UPDATE usuarios SET nombre = ?, email = ?, rol = ?, activo = ? WHERE id = ?`;
    db.query(update, [nombre, email, roleNorm, activo !== false, id], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'Email ya existe' });
        }
        console.error('Error al actualizar usuario:', err);
        return res.status(500).json({ error: 'Error al actualizar usuario: ' + err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      db.query('SELECT id, username, nombre, email, rol, activo, fecha_creacion, fecha_actualizacion FROM usuarios WHERE id = ?', [id], (gErr, rows) => {
        if (gErr) {
          console.error('Error al obtener usuario actualizado:', gErr);
          return res.status(500).json({ error: 'Error al obtener usuario actualizado: ' + gErr.message });
        }
        res.json(rows[0]);
      });
    });
  } catch (error) {
    console.error('Error al validar rol del usuario:', error);
    return res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// Cambiar contraseña
app.patch('/api/users/:id/password', verifyToken, async (req, res) => {
  const requester = req.user;
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña es obligatoria y debe tener al menos 6 caracteres' });
  }
  const isAdmin = hasPermission(requester, 'users.manage');
  const isSelf = String(requester?.id) === String(id);
  if (!isAdmin && !isSelf) {
    return res.status(403).json({ error: 'Permisos insuficientes' });
  }
  try {
    // Si no es admin, verificar contraseña actual
    if (!isAdmin) {
      const row = await new Promise((resolve, reject) => {
        db.query('SELECT password FROM usuarios WHERE id = ?', [id], (err, rows) => {
          if (err) return reject(err);
          resolve(rows && rows[0]);
        });
      });
      if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });
      const ok = await bcrypt.compare(String(currentPassword || ''), row.password);
      if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    db.query('UPDATE usuarios SET password = ? WHERE id = ?', [hashed, id], (err, result) => {
      if (err) {
        console.error('Error al actualizar contraseña:', err);
        return res.status(500).json({ error: 'Error al actualizar contraseña' });
      }
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
      res.json({ message: 'Contraseña actualizada' });
    });
  } catch (e) {
    console.error('Error en cambio de contraseña:', e);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Ruta de login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }
  
  const query = 'SELECT * FROM usuarios WHERE username = ? AND activo = TRUE';
  
  db.query(query, [username], async (err, results) => {
    if (err) {
      console.error('Error al buscar usuario:', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
    
    if (results.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    const user = results[0];
    
    try {
      // Verificar contraseña
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      
      const authUser = await buildAuthUser(user);

      // Crear JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          nombre: user.nombre,
          rol: user.rol 
        },
        jwtSecret,
        { expiresIn: '8h' }
      );
      
      res.json({
        token,
        user: authUser
      });
      
    } catch (error) {
      console.error('Error al verificar contraseña:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  });
});

// Ruta para verificar token
app.get('/api/verify-token', verifyToken, (req, res) => {
  res.json(req.user);
});

// CRUD Tipos de Soporte
// Listar tipos de soporte con búsqueda y paginación opcional
app.get('/api/tipos-soporte', verifyToken, requirePermission('tipos_soporte.view'), (req, res) => {
  const { search = '', page = 1, limit = 50, include_inactivos = 'false' } = req.query;
  const numericLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
  const numericPage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (numericPage - 1) * numericLimit;
  const whereParts = [];
  const params = [];
  if (include_inactivos !== 'true') {
    whereParts.push('activo = TRUE');
  }
  if (search && search.trim()) {
    whereParts.push('(nombre LIKE ? OR descripcion LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const listQuery = `SELECT * FROM tipos_soporte ${whereClause} ORDER BY nombre ASC LIMIT ? OFFSET ?`;
  const countQuery = `SELECT COUNT(*) as total FROM tipos_soporte ${whereClause}`;

  db.query(countQuery, params, (cErr, cRows) => {
    if (cErr) {
      console.error('Error al contar tipos de soporte:', cErr);
      return res.status(500).json({ error: 'Error al obtener conteo' });
    }
    const total = cRows[0]?.total || 0;
    db.query(listQuery, [...params, numericLimit, offset], (err, results) => {
      if (err) {
        console.error('Error al obtener tipos de soporte:', err);
        return res.status(500).json({ error: 'Error al obtener tipos de soporte' });
      }
      res.set('Access-Control-Expose-Headers', 'X-Total-Count');
      res.set('X-Total-Count', String(total));
      res.json({ items: results, meta: { total, page: numericPage, limit: numericLimit } });
    });
  });
});

// Crear tipo de soporte
app.post('/api/tipos-soporte', verifyToken, requirePermission('tipos_soporte.manage'), (req, res) => {
  const { nombre, descripcion = '' } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  const insert = `INSERT INTO tipos_soporte (nombre, descripcion, activo) VALUES (?, ?, TRUE)`;
  db.query(insert, [nombre.trim(), descripcion], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'El nombre ya existe' });
      }
      console.error('Error al crear tipo de soporte:', err);
      return res.status(500).json({ error: 'Error al crear tipo de soporte' });
    }
    db.query('SELECT * FROM tipos_soporte WHERE id = ?', [result.insertId], (gErr, rows) => {
      if (gErr) {
        console.error('Error al obtener tipo creado:', gErr);
        return res.status(500).json({ error: 'Error al obtener tipo creado' });
      }
      res.status(201).json(rows[0]);
    });
  });
});

// Actualizar tipo de soporte
app.put('/api/tipos-soporte/:id', verifyToken, requirePermission('tipos_soporte.manage'), (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, activo } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  const update = `UPDATE tipos_soporte SET nombre = ?, descripcion = ?, activo = ? WHERE id = ?`;
  db.query(update, [nombre.trim(), descripcion || '', activo !== false, id], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'El nombre ya existe' });
      }
      console.error('Error al actualizar tipo de soporte:', err);
      return res.status(500).json({ error: 'Error al actualizar tipo de soporte' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tipo de soporte no encontrado' });
    }
    db.query('SELECT * FROM tipos_soporte WHERE id = ?', [id], (gErr, rows) => {
      if (gErr) {
        console.error('Error al obtener tipo actualizado:', gErr);
        return res.status(500).json({ error: 'Error al obtener tipo actualizado' });
      }
      res.json(rows[0]);
    });
  });
});

// Eliminar tipo de soporte
app.delete('/api/tipos-soporte/:id', verifyToken, requirePermission('tipos_soporte.manage'), (req, res) => {
  const { id } = req.params;
  const del = `DELETE FROM tipos_soporte WHERE id = ?`;
  db.query(del, [id], (err, result) => {
    if (err) {
      console.error('Error al eliminar tipo de soporte:', err);
      return res.status(500).json({ error: 'Error al eliminar tipo de soporte' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tipo de soporte no encontrado' });
    }
    res.json({ message: 'Tipo de soporte eliminado' });
  });
});

// Ruta para obtener historial de auditoría (con filtros, orden y paginación opcional)
app.get('/api/auditoria/:ticketId', verifyToken, requirePermission('audit.view'), (req, res) => {
  const ticketId = req.params.ticketId;

  // Parámetros opcionales: ?accion=UPDATE&username=juan&page=1&limit=20&sort=fecha_accion&order=DESC
  const {
    accion,
    username,
    page = 1,
    limit = 50,
    sort = 'fecha_accion',
    order = 'DESC',
    from,
    to
  } = req.query;

  const allowedSort = ['fecha_accion', 'accion', 'id', 'usuario_nombre', 'username'];
  const sortCol = allowedSort.includes(String(sort)) ? String(sort) : 'fecha_accion';
  const orderDir = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  let where = "a.tabla_afectada = 'tickets' AND a.id_registro = ?";
  const params = [ticketId];

  if (accion) {
    where += ' AND a.accion = ?';
    params.push(accion);
  }

  if (username) {
    where += ' AND (u.username LIKE ? OR u.nombre LIKE ?)';
    params.push(`%${username}%`, `%${username}%`);
  }

  if (from) {
    where += ' AND a.fecha_accion >= ?';
    params.push(new Date(from));
  }
  if (to) {
    where += ' AND a.fecha_accion <= ?';
    params.push(new Date(to));
  }

  const numericLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
  const numericPage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (numericPage - 1) * numericLimit;

  const query = `
    SELECT a.*, u.nombre as usuario_nombre, u.username
    FROM auditoria a
    LEFT JOIN usuarios u ON a.usuario_id = u.id
    WHERE ${where}
    ORDER BY ${sortCol} ${orderDir}
    LIMIT ? OFFSET ?
  `;

  db.query(query, [...params, numericLimit, offset], (err, results) => {
    if (err) {
      console.error('Error al obtener auditoría:', err);
      return res.status(500).json({ error: 'Error al obtener historial' });
    }

    // Asegurar consistencia de JSON en datos_anteriores/datos_nuevos
    const normalizeJson = (val) => {
      try {
        if (val == null) return null;
        if (typeof val === 'object') return val;
        return JSON.parse(val);
      } catch (_) {
        return val; // devolver como está si no es JSON válido
      }
    };

    const normalized = results.map((r) => ({
      ...r,
      datos_anteriores: normalizeJson(r.datos_anteriores),
      datos_nuevos: normalizeJson(r.datos_nuevos),
    }));

    // Consulta para total
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM auditoria a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE ${where}
    `;

    db.query(countQuery, params, (countErr, countRes) => {
      if (countErr) {
        console.error('Error al obtener total de auditoría:', countErr);
        return res.status(500).json({ error: 'Error al obtener total' });
      }
      const total = countRes[0]?.total || 0;
      res.setHeader('X-Total-Count', String(total));
      res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
      res.json({ items: normalized, meta: { total, page: numericPage, limit: numericLimit } });
    });
  });
});

// Obtener todos los tickets (ahora requiere autenticación)
app.get('/api/tickets', verifyToken, requirePermission('tickets.view'), (req, res) => {
  const query = `
    SELECT t.*, u.nombre AS creador_nombre, u.username AS creador_username
    FROM tickets t
    LEFT JOIN usuarios u ON t.creado_por = u.id
    ORDER BY t.fechaCreacion DESC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener tickets:', err);
      return res.status(500).json({ error: 'Error al obtener tickets' });
    }
    res.json(results);
  });
});

// Crear un nuevo ticket
app.post('/api/tickets', verifyToken, requirePermission('tickets.create'), (req, res) => {
  const { cliente, direccion, telefono, descripcion, tipoSoporte } = req.body;
  let { fechaProgramada } = req.body;
  const userId = req.user.id;
  
  if (!cliente || !direccion || !telefono || !descripcion || !tipoSoporte) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }
  // Estado por defecto sin flujo de cobro/pago
  const computedEstado = 'pendiente';

  // Normalizar fechaProgramada a formato MySQL DATETIME
  const normalizeDateTime = (input) => {
    try {
      if (!input) return null;
      const d = new Date(input);
      if (isNaN(d.getTime())) return null;
      const pad = (n) => String(n).padStart(2, '0');
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mi = pad(d.getMinutes());
      const ss = pad(d.getSeconds());
      return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
    } catch (_) {
      return null;
    }
  };
  const fpSql = normalizeDateTime(fechaProgramada);
  
  const query = `
    INSERT INTO tickets (cliente, direccion, telefono, descripcion, tipoSoporte, estado, fechaProgramada, creado_por, modificado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.query(query, [cliente, direccion, telefono, descripcion, tipoSoporte, computedEstado, fpSql, userId, userId], (err, result) => {
    if (err) {
      console.error('Error al crear ticket:', err);
      return res.status(500).json({ error: 'Error al crear ticket' });
    }
    
    // Obtener el ticket recién creado (con nombre del creador)
    db.query(`
      SELECT t.*, u.nombre AS creador_nombre, u.username AS creador_username
      FROM tickets t
      LEFT JOIN usuarios u ON t.creado_por = u.id
      WHERE t.id = ?
    `, [result.insertId], (err, results) => {
      if (err) {
        console.error('Error al obtener ticket creado:', err);
        return res.status(500).json({ error: 'Error al obtener ticket creado' });
      }
      res.status(201).json(results[0]);
    });
  });
});

// Actualizar un ticket existente
app.put('/api/tickets/:id', verifyToken, requirePermission('tickets.edit'), (req, res) => {
  const { id } = req.params;
  const { cliente, direccion, telefono, descripcion, tipoSoporte } = req.body;
  let { fechaProgramada } = req.body;
  const userId = req.user.id;
  
  if (!cliente || !direccion || !telefono || !descripcion || !tipoSoporte) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }
  // Normalizar fechaProgramada a formato MySQL DATETIME
  const normalizeDateTime = (input) => {
    try {
      if (!input) return null;
      const d = new Date(input);
      if (isNaN(d.getTime())) return null;
      const pad = (n) => String(n).padStart(2, '0');
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mi = pad(d.getMinutes());
      const ss = pad(d.getSeconds());
      return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
    } catch (_) {
      return null;
    }
  };
  const fpSql = normalizeDateTime(fechaProgramada);
  const query = `
    UPDATE tickets
    SET cliente = ?, direccion = ?, telefono = ?, descripcion = ?, tipoSoporte = ?, fechaProgramada = ?, modificado_por = ?
    WHERE id = ? AND estado <> 'resuelto' AND estado <> 'cancelado'
  `;
  
  db.query(query, [cliente, direccion, telefono, descripcion, tipoSoporte, fpSql, userId, id], (err, result) => {
    if (err) {
      console.error('Error al actualizar ticket:', err);
      return res.status(500).json({ error: 'Error al actualizar ticket' });
    }
    
    if (result.affectedRows === 0) {
      // Verificar si existe y está resuelto
      db.query('SELECT estado FROM tickets WHERE id = ?', [id], (selErr, selRows) => {
        if (selErr) {
          console.error('Error al verificar estado del ticket:', selErr);
          return res.status(500).json({ error: 'Error al verificar ticket' });
        }
        if (!selRows || selRows.length === 0) {
          return res.status(404).json({ error: 'Ticket no encontrado' });
        }
        if (selRows[0].estado === 'resuelto') {
          return res.status(400).json({ error: 'No se puede modificar un ticket resuelto' });
        }
        if (selRows[0].estado === 'cancelado') {
          return res.status(400).json({ error: 'No se puede modificar un ticket cancelado' });
        }
        return res.status(400).json({ error: 'No se pudo actualizar el ticket' });
      });
      return;
    }
    
    function proceedSelect() {
    // Obtener el ticket actualizado (con nombre del creador)
    db.query(`
      SELECT t.*, u.nombre AS creador_nombre, u.username AS creador_username
      FROM tickets t
      LEFT JOIN usuarios u ON t.creado_por = u.id
      WHERE t.id = ?
    `, [id], (err, results) => {
      if (err) {
        console.error('Error al obtener ticket actualizado:', err);
        return res.status(500).json({ error: 'Error al obtener ticket actualizado' });
      }
      res.json(results[0]);
    });
    }
    
    proceedSelect();
  });
});

// Actualizar el estado de un ticket
app.patch('/api/tickets/:id/estado', verifyToken, requirePermission('tickets.change_status'), (req, res) => {
  const { id } = req.params;
  const { estado, motivo_cancelacion } = req.body;
  const userId = req.user.id;
  
  if (!estado) {
    return res.status(400).json({ error: 'El estado es obligatorio' });
  }
  
  // Obtener datos anteriores antes de actualizar para registrar auditoría
  db.query('SELECT cliente, direccion, telefono, descripcion, tipoSoporte, estado, motivo_cancelacion FROM tickets WHERE id = ?', [id], (selErr, rows) => {
    if (selErr) {
      console.error('Error al consultar ticket antes de actualizar estado:', selErr);
      return res.status(500).json({ error: 'Error al consultar ticket' });
    }
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }
    const oldData = rows[0];
    if (oldData.estado === 'resuelto') {
      return res.status(400).json({ error: 'No se puede cambiar el estado de un ticket resuelto' });
    }
    if (oldData.estado === 'cancelado') {
      return res.status(400).json({ error: 'No se puede cambiar el estado de un ticket cancelado' });
    }

    // Validar motivo al cancelar
    if (estado === 'cancelado') {
      if (!motivo_cancelacion || String(motivo_cancelacion).trim().length === 0) {
        return res.status(400).json({ error: 'El motivo de cancelación es obligatorio' });
      }
    }

    let updateQuery = `UPDATE tickets SET estado = ?, modificado_por = ? WHERE id = ?`;
    let updateParams = [estado, userId, id];
    if (estado === 'cancelado') {
      updateQuery = `UPDATE tickets SET estado = ?, motivo_cancelacion = ?, modificado_por = ? WHERE id = ?`;
      updateParams = [estado, motivo_cancelacion, userId, id];
    }

    db.query(updateQuery, updateParams, (updErr, result) => {
      if (updErr) {
        console.error('Error al actualizar estado del ticket:', updErr);
        return res.status(500).json({ error: 'Error al actualizar estado del ticket' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Ticket no encontrado' });
      }

      // Fallback: registrar auditoría directa solo si no existe el trigger de UPDATE
      const triggerCheck = `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = 'tickets_audit_update'`;
      db.query(triggerCheck, (trErr, trRows) => {
        if (trErr) {
          console.warn('No se pudo verificar trigger de auditoría, se intentará registrar auditoría directa:', trErr);
        }
        const hasTrigger = Array.isArray(trRows) && trRows.length > 0;
        if (!hasTrigger) {
          const auditInsert = `
            INSERT INTO auditoria (tabla_afectada, id_registro, accion, datos_anteriores, datos_nuevos, usuario_id)
            VALUES (
              'tickets', ?, 'UPDATE',
              JSON_OBJECT(
                'cliente', ?,
                'direccion', ?,
                'telefono', ?,
                'descripcion', ?,
                'tipoSoporte', ?,
                'estado', ?,
                'motivo_cancelacion', ?
              ),
              JSON_OBJECT(
                'cliente', ?,
                'direccion', ?,
                'telefono', ?,
                'descripcion', ?,
                'tipoSoporte', ?,
                'estado', ?,
                'motivo_cancelacion', ?
              ),
              ?
            )
          `;
          const params = [
            id,
            // anteriores
            oldData.cliente,
            oldData.direccion,
            oldData.telefono,
            oldData.descripcion,
            oldData.tipoSoporte,
            oldData.estado,
            oldData.motivo_cancelacion || null,
            // nuevos (solo cambia estado)
            oldData.cliente,
            oldData.direccion,
            oldData.telefono,
            oldData.descripcion,
            oldData.tipoSoporte,
            estado,
            estado === 'cancelado' ? motivo_cancelacion : oldData.motivo_cancelacion || null,
            userId
          ];
          db.query(auditInsert, params, (aiErr) => {
            if (aiErr) {
              console.error('Error al registrar auditoría directa:', aiErr);
            }
            // continuar respuesta independientemente
            finishResponse();
          });
        } else {
          // Trigger existe, solo responder
          finishResponse();
        }
      });

      function finishResponse() {
        db.query(`
          SELECT t.*, u.nombre AS creador_nombre, u.username AS creador_username
          FROM tickets t
          LEFT JOIN usuarios u ON t.creado_por = u.id
          WHERE t.id = ?
        `, [id], (getErr, results) => {
          if (getErr) {
            console.error('Error al obtener ticket actualizado:', getErr);
            return res.status(500).json({ error: 'Error al obtener ticket actualizado' });
          }
          res.json(results[0]);
        });
      }
    });
  });
});

// Eliminar un ticket
app.delete('/api/tickets/:id', verifyToken, requirePermission('tickets.delete'), (req, res) => {
  const { id } = req.params;
  
  const query = 'DELETE FROM tickets WHERE id = ?';
  
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error al eliminar ticket:', err);
      return res.status(500).json({ error: 'Error al eliminar ticket' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }
    
    res.json({ message: 'Ticket eliminado correctamente' });
  });
});




// [Deprecated] Ruta antigua de tiposoporte eliminada en favor de /api/tipos-soporte

// Servir archivos estáticos del frontend (React build) en producción
// Esto permite que el backend sirva también la aplicación web en el mismo puerto
const buildPath = path.join(__dirname, '../build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  
  // Manejar cualquier otra ruta devolviendo el index.html (para React Router)
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor backend ejecutándose en el puerto ${port}`);
});
