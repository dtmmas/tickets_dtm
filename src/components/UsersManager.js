import React from 'react';
import { PERMISSION_GROUPS, hasPermission } from '../permissions';
import { DEFAULT_BRAND } from '../branding';

const UsersManager = ({ apiUrl, onClose, currentUser, brandPalette = DEFAULT_BRAND }) => {
  const toUpperValue = (value) => String(value || '').toUpperCase();
  const token = localStorage.getItem('token');
  const canManageUsers = hasPermission(currentUser, 'users.manage');
  const canManageRoles = hasPermission(currentUser, 'roles.manage');
  const availableTabs = [
    canManageUsers ? 'users' : null,
    canManageRoles ? 'roles' : null
  ].filter(Boolean);

  const [activeTab, setActiveTab] = React.useState(availableTabs[0] || 'users');
  const [items, setItems] = React.useState([]);
  const [roles, setRoles] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [includeInactive, setIncludeInactive] = React.useState(true);
  const [includeInactiveRoles, setIncludeInactiveRoles] = React.useState(true);

  const emptyUserForm = { username: '', nombre: '', email: '', rol: '', password: '', activo: true };
  const emptyRoleForm = { nombre: '', descripcion: '', permisos: [], activo: true };

  const [form, setForm] = React.useState(emptyUserForm);
  const [roleForm, setRoleForm] = React.useState(emptyRoleForm);
  const [editing, setEditing] = React.useState(null);
  const [editingRole, setEditingRole] = React.useState(null);
  const [pwdUserId, setPwdUserId] = React.useState(null);
  const [newPassword, setNewPassword] = React.useState('');

  const selectableRoles = React.useMemo(() => {
    if (includeInactiveRoles) return roles;
    return roles.filter((role) => role.activo);
  }, [roles, includeInactiveRoles]);

  const syncDefaultRole = React.useCallback((roleItems) => {
    setForm((prev) => {
      const hasCurrentRole = roleItems.some((role) => role.nombre === prev.rol);
      if (prev.rol && hasCurrentRole) return prev;
      const firstActive = roleItems.find((role) => role.activo) || roleItems[0];
      return { ...prev, rol: firstActive?.nombre || '' };
    });
  }, []);

  const fetchRoles = React.useCallback(async () => {
    if (!canManageUsers && !canManageRoles) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ include_inactivos: includeInactiveRoles ? 'true' : 'false' });
      const resp = await fetch(`${apiUrl}/roles?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || 'Error al listar roles');
      }
      const data = await resp.json();
      const roleItems = Array.isArray(data) ? data : [];
      setRoles(roleItems);
      syncDefaultRole(roleItems);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, canManageRoles, canManageUsers, includeInactiveRoles, syncDefaultRole, token]);

  const fetchUsers = React.useCallback(async () => {
    if (!canManageUsers) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        search,
        include_inactivos: includeInactive ? 'true' : 'false',
        limit: '100'
      });
      const resp = await fetch(`${apiUrl}/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || 'Error al listar usuarios');
      }
      const data = await resp.json();
      setItems(data.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, canManageUsers, includeInactive, search, token]);

  React.useEffect(() => {
    if (canManageUsers) fetchUsers();
    if (canManageUsers || canManageRoles) fetchRoles();
  }, [canManageRoles, canManageUsers, fetchRoles, fetchUsers]);

  React.useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] || 'users');
    }
  }, [activeTab, availableTabs]);

  const resetUserForm = () => {
    setEditing(null);
    setForm((prev) => ({ ...emptyUserForm, rol: prev.rol || selectableRoles.find((role) => role.activo)?.nombre || '' }));
  };

  const resetRoleForm = () => {
    setEditingRole(null);
    setRoleForm(emptyRoleForm);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    setError('');
    try {
      const payload = {
        username: form.username.trim(),
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        rol: form.rol,
        activo: !!form.activo
      };
      let url = `${apiUrl}/users`;
      let method = 'POST';
      if (editing) {
        url = `${apiUrl}/users/${editing.id}`;
        method = 'PUT';
      } else {
        payload.password = form.password;
      }
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || 'Error al guardar usuario');
      }
      await fetchUsers();
      resetUserForm();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSubmit = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    setError('');
    try {
      const payload = {
        nombre: roleForm.nombre.trim(),
        descripcion: roleForm.descripcion.trim(),
        permisos: roleForm.permisos,
        activo: !!roleForm.activo
      };
      const url = editingRole ? `${apiUrl}/roles/${editingRole.id}` : `${apiUrl}/roles`;
      const method = editingRole ? 'PUT' : 'POST';
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || 'Error al guardar rol');
      }
      await fetchRoles();
      await fetchUsers();
      resetRoleForm();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (u) => {
    setEditing(u);
    setActiveTab('users');
    setForm({
      username: u.username,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      password: '',
      activo: !!u.activo
    });
  };

  const startEditRole = (role) => {
    setEditingRole(role);
    setActiveTab('roles');
    setRoleForm({
      nombre: role.nombre,
      descripcion: role.descripcion || '',
      permisos: role.permisos || [],
      activo: !!role.activo
    });
  };

  const startChangePwd = (u) => {
    setPwdUserId(u.id);
    setNewPassword('');
  };

  const applyChangePwd = async () => {
    setLoading(true);
    setError('');
    try {
      if (!newPassword || newPassword.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres');
      }
      const resp = await fetch(`${apiUrl}/users/${pwdUserId}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword })
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || 'Error al actualizar contraseña');
      }
      setPwdUserId(null);
      setNewPassword('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (permissionKey) => {
    setRoleForm((prev) => {
      const exists = prev.permisos.includes(permissionKey);
      return {
        ...prev,
        permisos: exists
          ? prev.permisos.filter((item) => item !== permissionKey)
          : [...prev.permisos, permissionKey]
      };
    });
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex items-center justify-center h-full px-2 md:px-4">
        <div className="bg-white rounded-2xl shadow-lg w-full max-w-7xl max-h-[95vh] overflow-hidden border border-slate-200">
          <div
            className="h-1.5 w-full"
            style={{ background: `linear-gradient(90deg, ${brandPalette.primary}, ${brandPalette.deep})` }}
          />
          <div className="pb-1 pt-4 px-4 md:px-6 text-left flex items-center justify-between border-b">
            <div>
              <div
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] mb-2"
                style={{ backgroundColor: brandPalette.soft, color: brandPalette.deep }}
              >
                Administración
              </div>
              <div className="text-[1.5rem] font-semibold text-[#2c3e50]">Gestión de Usuarios y Roles</div>
            </div>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
          </div>

          <div className="px-4 md:px-6 pt-4 pb-4 h-[calc(95vh-72px)] overflow-auto">
            {error && <div className="bg-red-600 text-white px-3 py-2 rounded mb-3 text-sm">{error}</div>}

            <div className="mb-4 flex flex-wrap gap-2">
              {canManageUsers && (
                <button
                  type="button"
                  onClick={() => setActiveTab('users')}
                  className={`rounded-md px-4 py-2 text-sm border ${activeTab === 'users' ? 'text-white' : 'bg-gray-100 text-gray-700 border-gray-300'}`}
                  style={activeTab === 'users'
                    ? { backgroundColor: brandPalette.primary, borderColor: brandPalette.deep, boxShadow: `0 10px 24px ${brandPalette.softer}` }
                    : undefined}
                >
                  Usuarios
                </button>
              )}
              {canManageRoles && (
                <button
                  type="button"
                  onClick={() => setActiveTab('roles')}
                  className={`rounded-md px-4 py-2 text-sm border ${activeTab === 'roles' ? 'text-white' : 'bg-gray-100 text-gray-700 border-gray-300'}`}
                  style={activeTab === 'roles'
                    ? { backgroundColor: brandPalette.primary, borderColor: brandPalette.deep, boxShadow: `0 10px 24px ${brandPalette.softer}` }
                    : undefined}
                >
                  Roles y accesos
                </button>
              )}
            </div>

            {activeTab === 'users' && canManageUsers && (
              <>
                <div className="mb-3 flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[220px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                    <input
                      value={search}
                      onChange={(e) => setSearch(toUpperValue(e.target.value))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="username, nombre o email"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Opciones</label>
                    <label className="inline-flex items-center text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={includeInactive}
                        onChange={(e) => setIncludeInactive(e.target.checked)}
                        className="mr-2"
                      />
                      Incluir inactivos
                    </label>
                  </div>
                  <button onClick={fetchUsers} className="rounded-md text-white px-3 py-2 text-sm" style={{ backgroundColor: brandPalette.primary }}>
                    Buscar
                  </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-1 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">{editing ? 'Editar usuario' : 'Crear usuario'}</h3>
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Usuario</label>
                        <input
                          value={form.username}
                          onChange={(e) => setForm({ ...form, username: toUpperValue(e.target.value) })}
                          disabled={!!editing}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          required
                        />
                      </div>
                      {!editing && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña</label>
                          <input
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                            required
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
                        <input
                          value={form.nombre}
                          onChange={(e) => setForm({ ...form, nombre: toUpperValue(e.target.value) })}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Rol</label>
                        <select
                          value={form.rol}
                          onChange={(e) => setForm({ ...form, rol: e.target.value })}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          required
                        >
                          <option value="">Seleccione un rol</option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.nombre}>
                              {role.nombre}{role.activo ? '' : ' (inactivo)'}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="inline-flex items-center text-xs font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={form.activo}
                            onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                            className="mr-2"
                          />
                          Activo
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={loading}
                          className="rounded-md text-white px-3 py-1.5 text-sm"
                          style={{ backgroundColor: brandPalette.primary }}
                        >
                          {editing ? 'Guardar cambios' : 'Crear'}
                        </button>
                        <button type="button" onClick={resetUserForm} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
                          Limpiar
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="xl:col-span-2">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Usuarios</h3>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Usuario</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Nombre</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Email</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Rol</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Estado</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {items.length === 0 ? (
                            <tr>
                              <td className="px-4 py-6 text-center text-gray-500" colSpan={6}>Sin usuarios</td>
                            </tr>
                          ) : (
                            items.map((u) => (
                              <tr key={u.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-sm text-gray-700">{u.username}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">{u.nombre}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">{u.email}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">
                                  <div className="font-medium">{u.rol}</div>
                                  {u.role_descripcion && <div className="text-xs text-gray-500">{u.role_descripcion}</div>}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-700">{u.activo ? 'Activo' : 'Inactivo'}</td>
                                <td className="px-4 py-2 text-sm">
                                  <div className="flex gap-2">
                                    <button onClick={() => startEdit(u)} className="p-2 rounded-md border border-gray-300 text-gray-700 bg-gray-100 hover:bg-gray-200" title="Editar">
                                      ✏️
                                    </button>
                                    <button onClick={() => startChangePwd(u)} className="p-2 rounded-md border border-gray-300 text-gray-700 bg-gray-100 hover:bg-gray-200" title="Cambiar contraseña">
                                      🔑
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'roles' && canManageRoles && (
              <>
                <div className="mb-3 flex flex-wrap gap-2 items-end">
                  <div>
                    <label className="inline-flex items-center text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={includeInactiveRoles}
                        onChange={(e) => setIncludeInactiveRoles(e.target.checked)}
                        className="mr-2"
                      />
                      Incluir roles inactivos
                    </label>
                  </div>
                  <button onClick={fetchRoles} className="rounded-md text-white px-3 py-2 text-sm" style={{ backgroundColor: brandPalette.primary }}>
                    Recargar roles
                  </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-1 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">{editingRole ? 'Editar rol' : 'Crear rol'}</h3>
                    <form onSubmit={handleRoleSubmit} className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del rol</label>
                        <input
                          value={roleForm.nombre}
                          onChange={(e) => setRoleForm({ ...roleForm, nombre: toUpperValue(e.target.value) })}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
                        <textarea
                          value={roleForm.descripcion}
                          onChange={(e) => setRoleForm({ ...roleForm, descripcion: toUpperValue(e.target.value) })}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[90px]"
                        />
                      </div>
                      <div>
                        <label className="inline-flex items-center text-xs font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={roleForm.activo}
                            onChange={(e) => setRoleForm({ ...roleForm, activo: e.target.checked })}
                            className="mr-2"
                          />
                          Rol activo
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={loading}
                          className="rounded-md text-white px-3 py-1.5 text-sm"
                          style={{ backgroundColor: brandPalette.primary }}
                        >
                          {editingRole ? 'Guardar rol' : 'Crear rol'}
                        </button>
                        <button type="button" onClick={resetRoleForm} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
                          Limpiar
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="xl:col-span-2 space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Permisos del rol</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {PERMISSION_GROUPS.map((group) => (
                          <div key={group.key} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                            <div className="text-sm font-semibold text-gray-800 mb-2">{group.label}</div>
                            <div className="space-y-2">
                              {group.permissions.map((permission) => (
                                <label key={permission.key} className="flex items-start gap-2 text-sm text-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={roleForm.permisos.includes(permission.key)}
                                    onChange={() => togglePermission(permission.key)}
                                    className="mt-0.5"
                                  />
                                  <span>{permission.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b">
                        <h3 className="text-sm font-semibold text-gray-700">Roles creados</h3>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {roles.length === 0 ? (
                          <div className="px-4 py-6 text-center text-gray-500 text-sm">Sin roles</div>
                        ) : (
                          roles.map((role) => (
                            <div key={role.id} className="px-4 py-4 flex flex-col lg:flex-row lg:items-start gap-3">
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <div className="font-semibold text-gray-800">{role.nombre}</div>
                                  {role.sistema && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Sistema</span>}
                                  {!role.activo && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Inactivo</span>}
                                </div>
                                <div className="text-sm text-gray-600 mb-2">{role.descripcion || 'Sin descripción'}</div>
                                <div className="flex flex-wrap gap-2">
                                  {(role.permisos || []).map((permission) => (
                                    <span key={permission} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                      {permission}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <button onClick={() => startEditRole(role)} className="rounded-md border border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 text-sm">
                                  Editar rol
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {pwdUserId && (
              <div className="mt-4 rounded-lg border p-3">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Cambiar contraseña</h4>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nueva contraseña</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <button onClick={applyChangePwd} className="rounded-md text-white px-3 py-1.5 text-sm" style={{ backgroundColor: brandPalette.primary }}>
                    Actualizar
                  </button>
                  <button onClick={() => { setPwdUserId(null); setNewPassword(''); }} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-4 border-gray-300 border-t-transparent animate-spin" />
        </div>
      )}
    </div>
  );
};

export default UsersManager;
