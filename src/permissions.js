export const PERMISSION_GROUPS = [
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

export const hasPermission = (user, permission) => {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes(permission);
};
