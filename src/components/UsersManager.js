import React from 'react';

const UsersManager = ({ apiUrl, onClose }) => {
  const token = localStorage.getItem('token');
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [includeInactive, setIncludeInactive] = React.useState(true);

  const emptyForm = { username: '', nombre: '', email: '', rol: 'usuario', password: '', activo: true };
  const [form, setForm] = React.useState(emptyForm);
  const [editing, setEditing] = React.useState(null);
  const [pwdUserId, setPwdUserId] = React.useState(null);
  const [newPassword, setNewPassword] = React.useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ search, include_inactivos: includeInactive ? 'true' : 'false', limit: '100' });
      const resp = await fetch(`${apiUrl}/users?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
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
  };

  React.useEffect(() => { fetchUsers(); }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    setError('');
    try {
      const payload = { username: form.username, nombre: form.nombre, email: form.email, rol: form.rol, activo: !!form.activo };
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
      setForm(emptyForm);
      setEditing(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (u) => {
    setEditing(u);
    setForm({ username: u.username, nombre: u.nombre, email: u.email, rol: u.rol, password: '', activo: !!u.activo });
  };

  const startChangePwd = (u) => {
    setPwdUserId(u.id);
    setNewPassword('');
  };

  const applyChangePwd = async () => {
    setLoading(true);
    setError('');
    try {
      if (!newPassword || newPassword.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
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

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex items-center justify-center h-full px-4">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl overflow-visible">
          <div className="pb-1 pt-4 px-4 md:px-6 text-left flex items-center justify-between">
            <div className="text-[1.5rem] font-semibold text-[#2c3e50]">Gestión de Usuarios</div>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
          </div>
          <div className="px-4 md:px-6 pt-4 pb-4">
            {error && <div className="bg-red-600 text-white px-3 py-2 rounded mb-3 text-sm">{error}</div>}
            <div className="mb-3 flex gap-2 items-end">
              <div className="flex-1 min-w-[220px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                <input value={search} onChange={(e)=>setSearch(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="username, nombre o email" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opciones</label>
                <label className="inline-flex items-center text-sm text-gray-700">
                  <input type="checkbox" checked={includeInactive} onChange={(e)=>setIncludeInactive(e.target.checked)} className="mr-2" />Incluir inactivos
                </label>
              </div>
              <button onClick={fetchUsers} className="rounded-md border border-gray-300 bg-gray-100 text-gray-700 px-3 py-2 text-sm hover:bg-gray-200">Buscar</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{editing ? 'Editar usuario' : 'Crear usuario'}</h3>
                <form onSubmit={handleSubmit} className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Usuario</label>
                    <input value={form.username} onChange={(e)=>setForm({ ...form, username: e.target.value })} disabled={!!editing} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
                  </div>
                  {!editing && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña</label>
                      <input type="password" value={form.password} onChange={(e)=>setForm({ ...form, password: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
                    <input value={form.nombre} onChange={(e)=>setForm({ ...form, nombre: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={form.email} onChange={(e)=>setForm({ ...form, email: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Rol</label>
                    <select value={form.rol} onChange={(e)=>setForm({ ...form, rol: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                      <option value="usuario">Usuario</option>
                      <option value="tecnico">Técnico</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div>
                    <label className="inline-flex items-center text-xs font-medium text-gray-700 mb-1">
                      <input type="checkbox" checked={form.activo} onChange={(e)=>setForm({ ...form, activo: e.target.checked })} className="mr-2" />Activo
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={loading} className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-sm">{editing ? 'Guardar cambios' : 'Crear'}</button>
                    {editing && (
                      <button type="button" onClick={()=>{ setEditing(null); setForm(emptyForm); }} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">Cancelar</button>
                    )}
                  </div>
                </form>
              </div>

              <div className="md:col-span-2">
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
                        items.map(u => (
                          <tr key={u.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-700">{u.username}</td>
                            <td className="px-4 py-2 text-sm text-gray-700">{u.nombre}</td>
                            <td className="px-4 py-2 text-sm text-gray-700">{u.email}</td>
                            <td className="px-4 py-2 text-sm text-gray-700">{u.rol}</td>
                            <td className="px-4 py-2 text-sm text-gray-700">{u.activo ? 'Activo' : 'Inactivo'}</td>
                            <td className="px-4 py-2 text-sm">
                              <div className="flex gap-2">
                                <button onClick={()=>startEdit(u)} className="p-2 rounded-md border border-gray-300 text-gray-700 bg-gray-100 hover:bg-gray-200" title="Editar">✏️</button>
                                <button onClick={()=>startChangePwd(u)} className="p-2 rounded-md border border-gray-300 text-gray-700 bg-gray-100 hover:bg-gray-200" title="Cambiar contraseña">🔑</button>
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

            {pwdUserId && (
              <div className="mt-4 rounded-lg border p-3">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Cambiar contraseña</h4>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nueva contraseña</label>
                    <input type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <button onClick={applyChangePwd} className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-sm">Actualizar</button>
                  <button onClick={()=>{ setPwdUserId(null); setNewPassword(''); }} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">Cancelar</button>
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