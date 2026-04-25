import React from 'react';

const TiposSoporteManager = ({ apiUrl, onClose }) => {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(10);
  const [total, setTotal] = React.useState(0);
  const [form, setForm] = React.useState({ id: null, nombre: '', descripcion: '', activo: true });
  const [formError, setFormError] = React.useState('');
  const [editing, setEditing] = React.useState(false);

  const token = localStorage.getItem('token');

  const fetchItems = async (opts = {}) => {
    setLoading(true);
    setError(null);
    try {
      const p = opts.page || page;
      const l = opts.limit || limit;
      const s = opts.search !== undefined ? opts.search : search;
      const resp = await fetch(`${apiUrl}/tipos-soporte?search=${encodeURIComponent(s)}&page=${p}&limit=${l}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      const meta = data.meta || { total: (resp.headers.get('X-Total-Count')|0), page: p, limit: l };
      setItems(data.items || data);
      setTotal(meta.total || 0);
      setPage(meta.page || p);
      setLimit(meta.limit || l);
    } catch (e) {
      setError('Error al cargar tipos de soporte');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchItems({ page: 1 }); }, []);

  const resetForm = () => {
    setForm({ id: null, nombre: '', descripcion: '', activo: true });
    setEditing(false);
    setFormError('');
  };

  const validate = () => {
    if (!form.nombre.trim()) {
      setFormError('El nombre es obligatorio');
      return false;
    }
    setFormError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `${apiUrl}/tipos-soporte/${form.id}` : `${apiUrl}/tipos-soporte`;
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nombre: form.nombre.trim(), descripcion: form.descripcion || '', activo: form.activo })
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || 'Error al guardar');
      }
      await fetchItems();
      resetForm();
    } catch (e) {
      setFormError(e.message);
    }
  };

  const handleEdit = (item) => {
    setForm({ id: item.id, nombre: (item.nombre || '').toUpperCase(), descripcion: (item.descripcion || '').toUpperCase(), activo: !!item.activo });
    setEditing(true);
    setFormError('');
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`¿Eliminar tipo de soporte "${item.nombre}"?`)) return;
    try {
      const resp = await fetch(`${apiUrl}/tipos-soporte/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || 'Error al eliminar');
      }
      await fetchItems();
    } catch (e) {
      alert(e.message);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex items-center justify-center h-full px-4">
        <div role="dialog" aria-modal="true" className="bg-white/90 backdrop-blur rounded-none sm:rounded-2xl shadow-2xl border border-gray-200 w-full max-w-screen-sm md:max-w-2xl lg:max-w-3xl h-full sm:h-auto max-h-[100vh] sm:max-h-[85vh] overflow-y-auto transition-all duration-200 ease-out">
          <div className="px-6 py-4 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur border-b border-gray-200">
            <div className="text-lg md:text-xl font-semibold text-slate-800">Tipos de Soporte</div>
            <button onClick={onClose} aria-label="Cerrar" className="rounded-md p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition">✕</button>
          </div>
          <div className="px-6 pb-4">
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end mb-3">
              <div className="w-full sm:w-auto">
                <label className="sr-only">Buscar</label>
                <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar por nombre o descripción" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" />
              </div>
              <button onClick={()=>fetchItems({ page: 1, search })} className="w-full sm:w-auto rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-sm transition">Buscar</button>
            </div>
            {error && <div className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded-lg mb-3 text-sm">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Listado</h3>
                {/* Vista móvil: tarjetas sin scroll horizontal */}
                <div className="sm:hidden space-y-2">
                  {items.length === 0 && (
                    <div className="p-3 text-center text-slate-500 border border-gray-200 rounded-xl bg-white">Sin resultados</div>
                  )}
                  {items.map(it => (
                    <div key={it.id} className="border border-gray-200 rounded-xl bg-white p-3">
                      <div className="font-medium text-slate-800 mb-1 break-words">{it.nombre}</div>
                      <div className="text-slate-600 text-sm mb-2 break-words">{it.descripcion || '-'}</div>
                      <div className="text-xs text-slate-600 mb-3">Activo: {it.activo ? 'Sí' : 'No'}</div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={()=>handleEdit(it)} className="flex-1 sm:flex-none px-3 py-1.5 rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs">Editar</button>
                        <button onClick={()=>handleDelete(it)} className="flex-1 sm:flex-none px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 text-xs">Eliminar</button>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Vista tablet/PC: tabla sin overflow horizontal */}
                <div className="hidden sm:block border border-gray-200 rounded-xl bg-white">
                  <table className="w-full text-xs md:text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-2 text-slate-600 font-medium">Nombre</th>
                        <th className="text-left p-2 text-slate-600 font-medium">Descripción</th>
                        <th className="text-left p-2 text-slate-600 font-medium">Activo</th>
                        <th className="text-left p-2 text-slate-600 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(it => (
                        <tr key={it.id} className="border-t border-gray-200 hover:bg-slate-50 transition">
                          <td className="p-2 break-words">{it.nombre}</td>
                          <td className="p-2 text-slate-600 break-words">{it.descripcion || '-'}</td>
                          <td className="p-2">{it.activo ? 'Sí' : 'No'}</td>
                          <td className="p-2 flex flex-wrap gap-2">
                            <button onClick={()=>handleEdit(it)} className="px-3 py-1.5 rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs sm:text-sm">Editar</button>
                            <button onClick={()=>handleDelete(it)} className="px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 text-xs sm:text-sm">Eliminar</button>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr><td colSpan={4} className="p-3 text-center text-slate-500">Sin resultados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-3">
                  <div className="text-xs text-slate-600">Página {page} de {totalPages} — {total} total</div>
                  <div className="flex items-center gap-2">
                    <button disabled={page<=1} onClick={()=>{setPage(p=>p-1); fetchItems({ page: page-1 });}} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs disabled:opacity-50 hover:bg-slate-50">Anterior</button>
                    <button disabled={page>=totalPages} onClick={()=>{setPage(p=>p+1); fetchItems({ page: page+1 });}} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs disabled:opacity-50 hover:bg-slate-50">Siguiente</button>
                    <select value={limit} onChange={(e)=>{const l = parseInt(e.target.value,10)||10; setLimit(l); fetchItems({ page: 1, limit: l });}} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs bg-white">
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">{editing ? 'Editar Tipo' : 'Nuevo Tipo'}</h3>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Nombre</label>
                    <input value={form.nombre} onChange={(e)=>setForm({...form, nombre: (e.target.value || '').toUpperCase()})} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Descripción</label>
                    <textarea value={form.descripcion} onChange={(e)=>setForm({...form, descripcion: (e.target.value || '').toUpperCase()})} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500" rows={3} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="activo" type="checkbox" checked={form.activo} onChange={(e)=>setForm({...form, activo: e.target.checked})} />
                    <label htmlFor="activo" className="text-sm text-slate-700">Activo</label>
                  </div>
                  {formError && <p className="text-xs text-red-600">{formError}</p>}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button type="submit" className="w-full sm:w-auto rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-sm transition">{editing ? 'Guardar Cambios' : 'Crear Tipo'}</button>
                    {editing && <button type="button" onClick={resetForm} className="w-full sm:w-auto rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-slate-50">Cancelar</button>}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TiposSoporteManager;
