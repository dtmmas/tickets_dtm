const PERMISSION_GROUPS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    permissions: [
      { key: 'dashboard.view', label: 'Ver dashboard' }
    ]
  },
  {
    key: 'tickets',
    label: 'Tickets',
    permissions: [
      { key: 'tickets.view', label: 'Ver tickets' },
      { key: 'tickets.create', label: 'Crear tickets' },
      { key: 'tickets.edit', label: 'Editar tickets' },
      { key: 'tickets.change_status', label: 'Cambiar estado' },
      { key: 'tickets.delete', label: 'Eliminar tickets' }
    ]
  },
  {
    key: 'calendar',
    label: 'Calendario',
    permissions: [
      { key: 'calendar.view', label: 'Ver calendario' }
    ]
  },
  {
    key: 'audit',
    label: 'Auditoria',
    permissions: [
      { key: 'audit.view', label: 'Ver historial de auditoria' }
    ]
  },
  {
    key: 'support_types',
    label: 'Tipos de soporte',
    permissions: [
      { key: 'tipos_soporte.view', label: 'Ver tipos de soporte' },
      { key: 'tipos_soporte.manage', label: 'Gestionar tipos de soporte' }
    ]
  },
  {
    key: 'settings',
    label: 'Configuracion',
    permissions: [
      { key: 'settings.manage', label: 'Gestionar configuracion' }
    ]
  },
  {
    key: 'users',
    label: 'Usuarios y roles',
    permissions: [
      { key: 'users.manage', label: 'Gestionar usuarios' },
      { key: 'roles.manage', label: 'Gestionar roles' }
    ]
  }
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.key)
);

const DEFAULT_ROLE_PERMISSIONS = {
  admin: ALL_PERMISSIONS,
  tecnico: [
    'dashboard.view',
    'tickets.view',
    'tickets.create',
    'tickets.edit',
    'tickets.change_status',
    'calendar.view',
    'audit.view',
    'tipos_soporte.view'
  ],
  usuario: [
    'dashboard.view',
    'tickets.view',
    'tickets.create',
    'calendar.view',
    'tipos_soporte.view'
  ]
};

const DEFAULT_ROLES = [
  {
    nombre: 'admin',
    descripcion: 'Acceso total al sistema',
    permisos: DEFAULT_ROLE_PERMISSIONS.admin,
    activo: true,
    sistema: true
  },
  {
    nombre: 'tecnico',
    descripcion: 'Gestion operativa de tickets',
    permisos: DEFAULT_ROLE_PERMISSIONS.tecnico,
    activo: true,
    sistema: true
  },
  {
    nombre: 'usuario',
    descripcion: 'Acceso basico para consultar y crear tickets',
    permisos: DEFAULT_ROLE_PERMISSIONS.usuario,
    activo: true,
    sistema: true
  }
];

const normalizePermissions = (permissions) => {
  const input = Array.isArray(permissions) ? permissions : [];
  return [...new Set(input.map((item) => String(item || '').trim()).filter((item) => ALL_PERMISSIONS.includes(item)))];
};

const normalizeRoleName = (name) => String(name || '').trim().toLowerCase();

module.exports = {
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLES,
  normalizePermissions,
  normalizeRoleName
};
