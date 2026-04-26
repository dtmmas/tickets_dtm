import React from 'react';
import { computeDiff } from './auditUtils';

// Componente para mostrar la lista de tickets
const TicketList = ({ tickets, estados, onEditTicket, onUpdateStatus, onDeleteTicket, apiUrl, permissions = {} }) => {
  const toUpperValue = (value) => String(value || '').toUpperCase();
  const {
    canEditTickets = true,
    canChangeTicketStatus = true,
    canDeleteTickets = true,
    canViewAudit = true
  } = permissions;

  const formatDateParts = (dateString) => {
    try {
      const d = new Date(dateString);
      const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      return { date, time };
    } catch (_) {
      return { date: String(dateString || ''), time: '' };
    }
  };

  const getEstadoClasses = (estado) => {
    switch (estado) {
      case 'pendiente':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'resuelto':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'cancelado':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  // Campos de pago removidos

  const [confirmState, setConfirmState] = React.useState({ open: false, message: '', onConfirm: null, variant: 'warning', context: null, type: null });
  const [cancelReason, setCancelReason] = React.useState('');
  const confirmBtnRef = React.useRef(null);
  const cancelBtnRef = React.useRef(null);

  const allowedTransitions = {
    pendiente: ['resuelto', 'cancelado'],
    resuelto: [],
    cancelado: []
  };

  const isTransitionAllowed = (current, next) => {
    if (current === next) return true;
    const allowed = allowedTransitions[current] || [];
    return allowed.includes(next);
  };

  const getCurrentUsername = () => {
    try {
      const u = localStorage.getItem('username');
      if (u) return u;
      const raw = localStorage.getItem('user');
      if (raw) {
        const obj = JSON.parse(raw);
        return obj?.username || obj?.name || obj?.nombre || 'usuario';
      }
    } catch (_) {}
    return 'usuario';
  };

  const [lastAudit, setLastAudit] = React.useState(null);
  const [auditOpen, setAuditOpen] = React.useState(false);
  const [auditItems, setAuditItems] = React.useState([]);
  const [auditLoading, setAuditLoading] = React.useState(false);
  const [auditError, setAuditError] = React.useState(null);
  const [auditTicketId, setAuditTicketId] = React.useState(null);
  const [auditFilter, setAuditFilter] = React.useState('');
  const [auditUserQuery, setAuditUserQuery] = React.useState('');
  const [auditFromDate, setAuditFromDate] = React.useState('');
  const [auditToDate, setAuditToDate] = React.useState('');
  const [auditPage, setAuditPage] = React.useState(1);
  const [auditLimit, setAuditLimit] = React.useState(20);
  const auditSort = 'fecha_accion';
  const [auditOrder, setAuditOrder] = React.useState('DESC');

  const [expandedAuditId, setExpandedAuditId] = React.useState(null);

  const toggleAuditDetails = (id) => {
    setExpandedAuditId(prev => prev === id ? null : id);
  };

  const friendlyFieldNames = {
    cliente: 'Cliente',
    telefono: 'Teléfono',
    descripcion: 'Descripción',
    tipoSoporte: 'Tipo de Soporte',
    estado: 'Estado',
    fechaProgramada: 'Fecha Programada',
    motivo_cancelacion: 'Motivo de Cancelación',
    creador_nombre: 'Creado por',
    fechaCreacion: 'Fecha de Creación',
    costo: 'Costo',
    pagado: 'Pagado',
    metodoPago: 'Método de Pago',
    username: 'Usuario',
    password: 'Password',
    nombre: 'Nombre',
    email: 'Email',
    rol: 'Rol',
    activo: 'Activo'
  };

  const friendlyActions = {
    CREATE: 'Creación',
    UPDATE: 'Actualización',
    DELETE: 'Eliminación'
  };

  const formatAuditValue = (key, value) => {
    if (value === null || value === undefined || value === '') return <em>(vacío)</em>;
    if (key === 'activo') return value ? 'Sí' : 'No';
    if (key.includes('fecha') || key === 'created_at') {
      try {
        return new Date(value).toLocaleString();
      } catch (e) { return value; }
    }
    return String(value);
  };

  const openConfirm = (message, onConfirm, variant = 'warning', context = null, type = null) => {
    setConfirmState({ open: true, message, onConfirm, variant, context, type });
    if (type === 'status' && context?.to === 'cancelado') {
      setCancelReason('');
    }
  };

  const closeConfirm = () => {
    setConfirmState({ open: false, message: '', onConfirm: null });
  };

  React.useEffect(() => {
    if (!confirmState.open) return;
    const focusTarget = confirmState.onConfirm ? confirmBtnRef.current : cancelBtnRef.current;
    focusTarget?.focus();

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeConfirm();
      } else if (e.key === 'Enter' && confirmState.onConfirm) {
        e.preventDefault();
        // Evitar confirmar sin motivo cuando se cancela
        if (confirmState.type === 'status' && confirmState.context?.to === 'cancelado' && !cancelReason.trim()) {
          return;
        }
        const fn = confirmState.onConfirm;
        closeConfirm();
        if (typeof fn === 'function') fn();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [cancelReason, confirmState.context, confirmState.onConfirm, confirmState.open, confirmState.type]);

  const fetchAudit = async (ticketId, opts = {}) => {
    try {
      setAuditLoading(true);
      setAuditError(null);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        accion: auditFilter || '',
        username: auditUserQuery || '',
        page: String(opts.page || auditPage),
        limit: String(opts.limit || auditLimit),
        sort: auditSort,
        order: auditOrder,
        from: auditFromDate || '',
        to: auditToDate || ''
      });
      const response = await fetch(`${apiUrl}/auditoria/${ticketId}?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Error al obtener auditoría');
      const data = await response.json();
      const items = Array.isArray(data) ? data : (data.items || []);
      const meta = data.meta || {};
      setAuditItems(items);
      if (meta.page) setAuditPage(meta.page);
      if (meta.limit) setAuditLimit(meta.limit);
    } catch (err) {
      console.error(err);
      setAuditError('No fue posible cargar el historial.');
    } finally {
      setAuditLoading(false);
    }
  };

  const openAudit = async (ticket) => {
    setAuditOpen(true);
    setAuditTicketId(ticket.id);
    setAuditFilter('');
    setAuditUserQuery('');
    setAuditFromDate('');
    setAuditToDate('');
    setAuditPage(1);
    await fetchAudit(ticket.id, { page: 1 });
  };

  const filteredAuditItems = React.useMemo(() => {
    const byAction = auditFilter ? auditItems.filter(i => i.accion === auditFilter) : auditItems;
    const q = auditUserQuery.trim().toLowerCase();
    if (!q) return byAction;
    return byAction.filter(i => {
      const name = (i.usuario_nombre || i.username || '').toLowerCase();
      return name.includes(q);
    });
  }, [auditItems, auditFilter, auditUserQuery]);

  const toCSV = (items) => {
    const headers = ['id','accion','usuario','fecha','datos_anteriores','datos_nuevos'];
    const rows = items.map(i => [
      i.id,
      i.accion,
      (i.usuario_nombre || i.username || ''),
      i.fecha_accion,
      typeof i.datos_anteriores === 'string' ? i.datos_anteriores : JSON.stringify(i.datos_anteriores || ''),
      typeof i.datos_nuevos === 'string' ? i.datos_nuevos : JSON.stringify(i.datos_nuevos || '')
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n');
    return csv;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none mb-3">
        <h2 className="text-xl font-semibold text-gray-800">Listado de Tickets</h2>
      </div>
      {lastAudit && (
        <div className="flex-none mb-3 rounded-md border border-blue-200 bg-blue-50 text-blue-800 px-3 py-2 text-sm flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M12 18a6 6 0 100-12 6 6 0 000 12z" />
          </svg>
          <span>
            {lastAudit.by} {lastAudit.action} el ticket #{lastAudit.ticketId}
            {lastAudit.action === 'cambió estado' && ` de "${lastAudit.from}" a "${lastAudit.to}"`} el {new Date(lastAudit.at).toLocaleString()}
          </span>
        </div>
      )}
      <div className="flex-1 overflow-auto border border-gray-200 rounded-lg relative bg-white shadow-sm">
        {/* Vista móvil (Tarjetas) */}
        <div className="block md:hidden">
          {tickets.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No hay tickets disponibles</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-gray-500">#{ticket.id}</span>
                    <span className={`px-2 py-0.5 rounded text-xs border ${getEstadoClasses(ticket.estado)}`}>
                      {ticket.estado.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="mb-2">
                    <div className="font-semibold text-gray-800">{ticket.cliente}</div>
                    <div className="text-sm text-gray-600">{ticket.telefono || 'Sin teléfono'}</div>
                  </div>
                  
                  <div className="mb-3 text-sm text-gray-700 whitespace-pre-line break-words">
                    {ticket.descripcion}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                    <div>
                      <span className="font-medium">Tipo:</span> {ticket.tipoSoporte}
                    </div>
                    <div>
                      <span className="font-medium">Fecha:</span> {formatDateParts(ticket?.fechaCreacion).date}
                    </div>
                    {ticket.fechaProgramada && (
                      <div className="col-span-2">
                        <span className="font-medium">Programado:</span> {new Date(ticket.fechaProgramada).toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <select
                      value={ticket.estado}
                      disabled={!canChangeTicketStatus}
                      onChange={(e) => {
                        if (!canChangeTicketStatus) return;
                        const nextEstado = e.target.value;
                        if (nextEstado === ticket.estado) return;
                        if (!isTransitionAllowed(ticket.estado, nextEstado)) {
                          openConfirm(`Transición no permitida de "${ticket.estado}" a "${nextEstado}"`, null, 'info');
                          return;
                        }
                        openConfirm(`¿Confirmar cambiar el estado a "${nextEstado}"?`, () => {
                          const reason = nextEstado === 'cancelado' ? cancelReason : undefined;
                          onUpdateStatus(ticket.id, nextEstado, reason);
                          setLastAudit({
                            action: 'cambió estado',
                            ticketId: ticket.id,
                            from: ticket.estado,
                            to: nextEstado,
                            by: getCurrentUsername(),
                            at: Date.now(),
                          });
                        }, 'warning', { id: ticket.id, cliente: ticket.cliente, telefono: ticket.telefono, descripcion: ticket.descripcion, from: ticket.estado, to: nextEstado }, 'status');
                      }}
                      className={`text-xs rounded border px-2 py-1 bg-white ${!canChangeTicketStatus ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {estados.map((estado) => (
                        <option key={estado} value={estado} disabled={estado !== ticket.estado && !isTransitionAllowed(ticket.estado, estado)}>
                          {estado.charAt(0).toUpperCase() + estado.slice(1)}
                        </option>
                      ))}
                    </select>

                    <div className="flex gap-2">
                      <button
                        onClick={() => onEditTicket(ticket)}
                        disabled={!canEditTickets || ticket.estado === 'resuelto' || ticket.estado === 'cancelado'}
                        className={`p-1.5 rounded border ${(!canEditTickets || ticket.estado === 'resuelto' || ticket.estado === 'cancelado') ? 'border-gray-200 text-gray-400 bg-gray-100' : 'border-gray-300 text-gray-700 bg-gray-100'}`}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M4 20h4l10.606-10.606a2 2 0 10-2.828-2.828L5.172 17.172A4 4 0 004 20z" /></svg>
                      </button>
                      {canDeleteTickets && (
                        <button
                          onClick={() => {
                            openConfirm('¿Seguro que deseas eliminar este ticket?', () => {
                              onDeleteTicket(ticket.id);
                              setLastAudit({
                                action: 'eliminó',
                                ticketId: ticket.id,
                                by: getCurrentUsername(),
                                at: Date.now(),
                              });
                            }, 'danger', { id: ticket.id, cliente: ticket.cliente }, 'delete');
                          }}
                          className="p-1.5 rounded border border-red-300 text-white bg-red-600"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4m-6 0h8m-9 4h10" /></svg>
                        </button>
                      )}
                      {canViewAudit && (
                        <button
                          onClick={() => openAudit(ticket)}
                          className="p-1.5 rounded border border-blue-300 text-white bg-blue-600"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vista escritorio (Tabla) */}
        <table className="min-w-full divide-y divide-gray-200 hidden md:table">
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-600 bg-gray-50">ID</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">Cliente</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">Teléfono</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">Descripción</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">Tipo</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">Fecha programada</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">Motivo cancelación</th>
              {/* Columnas de pago removidas */}
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">Creado por</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">Fecha</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">Estado</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tickets.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={11}>No hay tickets disponibles</td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm text-gray-700 leading-relaxed align-top">{ticket.id}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 leading-relaxed align-top">{ticket.cliente}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 leading-relaxed align-top">{ticket.telefono || '—'}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 leading-relaxed align-top whitespace-pre-line break-words">{ticket.descripcion}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 leading-relaxed align-top">{ticket.tipoSoporte}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 leading-relaxed align-top">{ticket.fechaProgramada ? new Date(ticket.fechaProgramada).toLocaleString() : '—'}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 leading-relaxed align-top">{ticket.estado === 'cancelado' ? (ticket.motivo_cancelacion || '—') : '—'}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 leading-relaxed align-top">{ticket.creador_nombre || '—'}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 leading-relaxed align-top">
                    {(() => {
                      const { date, time } = formatDateParts(ticket?.fechaCreacion);
                      return (
                        <div className="leading-snug">
                          <div className="whitespace-nowrap">{date}</div>
                          <div className="whitespace-nowrap text-gray-600">{time}</div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 leading-relaxed align-top">
                    <select
                      value={ticket.estado}
                      disabled={!canChangeTicketStatus}
                      onChange={(e) => {
                        if (!canChangeTicketStatus) return;
                        const nextEstado = e.target.value;
                        if (nextEstado === ticket.estado) return;
                        if (!isTransitionAllowed(ticket.estado, nextEstado)) {
                          openConfirm(`Transición no permitida de "${ticket.estado}" a "${nextEstado}"`, null, 'info');
                          return;
                        }
                        openConfirm(`¿Confirmar cambiar el estado a "${nextEstado}"?`, () => {
                          const reason = nextEstado === 'cancelado' ? cancelReason : undefined;
                          onUpdateStatus(ticket.id, nextEstado, reason);
                          setLastAudit({
                            action: 'cambió estado',
                            ticketId: ticket.id,
                            from: ticket.estado,
                            to: nextEstado,
                            by: getCurrentUsername(),
                            at: Date.now(),
                          });
                        }, 'warning', { id: ticket.id, cliente: ticket.cliente, telefono: ticket.telefono, descripcion: ticket.descripcion, from: ticket.estado, to: nextEstado }, 'status');
                      }}
                      className={`rounded-md border px-3 py-2 text-sm ${getEstadoClasses(ticket.estado)} ${!canChangeTicketStatus ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {estados.map((estado) => (
                        <option key={estado} value={estado} disabled={estado !== ticket.estado && !isTransitionAllowed(ticket.estado, estado)}>
                          {estado.charAt(0).toUpperCase() + estado.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-sm align-top">
                    <div className="flex gap-3">
                      <button
                        onClick={() => onEditTicket(ticket)}
                        aria-label="Editar"
                        disabled={!canEditTickets || ticket.estado === 'resuelto' || ticket.estado === 'cancelado'}
                        className={`px-3 py-2 rounded-md border ${(!canEditTickets || ticket.estado === 'resuelto' || ticket.estado === 'cancelado') ? 'border-gray-200 text-gray-400 bg-gray-100 cursor-not-allowed' : 'border-gray-300 text-gray-700 bg-gray-100 hover:bg-gray-200'}`}
                        title={(!canEditTickets || ticket.estado === 'resuelto' || ticket.estado === 'cancelado') ? 'No editable' : 'Editar'}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M4 20h4l10.606-10.606a2 2 0 10-2.828-2.828L5.172 17.172A4 4 0 004 20z" />
                        </svg>
                      </button>
                      {canDeleteTickets && (
                        <button
                          onClick={() => {
                            openConfirm('¿Seguro que deseas eliminar este ticket? Esta acción no se puede deshacer.', () => {
                              onDeleteTicket(ticket.id);
                              setLastAudit({
                                action: 'eliminó',
                                ticketId: ticket.id,
                                by: getCurrentUsername(),
                                at: Date.now(),
                              });
                            }, 'danger', { id: ticket.id, cliente: ticket.cliente, telefono: ticket.telefono, descripcion: ticket.descripcion }, 'delete');
                          }}
                          aria-label="Eliminar"
                          className="px-3 py-2 rounded-md border border-red-300 text-white bg-red-600 hover:bg-red-700"
                          title="Eliminar"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4m-6 0h8m-9 4h10" />
                          </svg>
                        </button>
                      )}
                      {canViewAudit && (
                        <button
                          onClick={() => openAudit(ticket)}
                          aria-label="Historial"
                          className="px-3 py-2 rounded-md border border-blue-300 text-white bg-blue-600 hover:bg-blue-700"
                          title="Ver historial"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {confirmState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-[90%] max-w-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              {confirmState.variant === 'danger' && (
                <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M12 7a5 5 0 100 10 5 5 0 000-10z" />
                </svg>
              )}
              {confirmState.variant === 'warning' && (
                <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.789-2.894L13.79 4.106a2 2 0 00-3.58 0L3.142 16.106A2 2 0 004.93 19z" />
                </svg>
              )}
              {confirmState.variant === 'info' && (
                <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M12 18a6 6 0 100-12 6 6 0 000 12z" />
                </svg>
              )}
              <h3 id="confirm-title" className="text-sm font-medium text-gray-800">Confirmación</h3>
            </div>
            <div className="px-4 py-4 text-sm text-gray-700">
              <p className="mb-2">{confirmState.message}</p>
              {confirmState.context && (
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <div><span className="font-semibold">Ticket:</span> #{confirmState.context.id}</div>
                  <div><span className="font-semibold">Cliente:</span> {confirmState.context.cliente}</div>
                  <div><span className="font-semibold">Teléfono:</span> {confirmState.context.telefono || '—'}</div>
                  <div><span className="font-semibold">Descripción:</span> {confirmState.context.descripcion}</div>
                  {confirmState.type === 'status' && (
                    <div><span className="font-semibold">Estado:</span> {confirmState.context.from} → {confirmState.context.to}</div>
                  )}
                  {confirmState.type === 'status' && confirmState.context?.to === 'cancelado' && (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Motivo de cancelación</label>
                      <input
                        type="text"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(toUpperValue(e.target.value))}
                        placeholder="Escribe el motivo..."
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs w-full"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button
                ref={cancelBtnRef}
                onClick={closeConfirm}
                className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
              {confirmState.onConfirm && (
                <button
                  ref={confirmBtnRef}
                  onClick={() => {
                    const fn = confirmState.onConfirm;
                    closeConfirm();
                    if (typeof fn === 'function') fn();
                  }}
                  className={
                    confirmState.variant === 'danger'
                      ? 'px-3 py-1.5 rounded-md border border-red-300 text-white bg-red-600 hover:bg-red-700'
                      : 'px-3 py-1.5 rounded-md border border-amber-300 text-white bg-amber-600 hover:bg-amber-700'
                  }
                  disabled={confirmState.type === 'status' && confirmState.context?.to === 'cancelado' && !cancelReason.trim()}
                >
                  Confirmar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {auditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-0 md:p-4">
          <div className="bg-white rounded-none md:rounded-lg shadow-lg w-full h-full md:max-w-7xl flex flex-col max-h-full" role="dialog" aria-modal="true" aria-labelledby="audit-title">
            <div className="px-4 py-3 border-b flex items-center justify-between flex-none">
              <h3 id="audit-title" className="text-sm font-medium text-gray-800">Historial de auditoría — Ticket #{auditTicketId}</h3>
              <button onClick={() => setAuditOpen(false)} className="text-gray-600 hover:text-gray-800">✕</button>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden px-4 py-4">
              <div className="mb-3 flex flex-wrap items-end gap-3 flex-none">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Acción</label>
                  <select value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs">
                    <option value="">Todas</option>
                    <option value="CREATE">CREATE</option>
                    <option value="UPDATE">UPDATE</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Usuario</label>
                  <input
                    type="text"
                    value={auditUserQuery}
                    onChange={(e) => setAuditUserQuery(toUpperValue(e.target.value))}
                    placeholder="Buscar por usuario"
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs w-44"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Desde</label>
                  <input
                    type="date"
                    value={auditFromDate}
                    onChange={(e) => setAuditFromDate(e.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={auditToDate}
                    onChange={(e) => setAuditToDate(e.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Orden</label>
                  <select value={auditOrder} onChange={(e) => setAuditOrder(e.target.value)} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs">
                    <option value="DESC">DESC</option>
                    <option value="ASC">ASC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Límite</label>
                  <select value={auditLimit} onChange={(e) => setAuditLimit(Number(e.target.value))} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs">
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div>
                  <button
                    onClick={() => fetchAudit(auditTicketId, { page: 1 })}
                    className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-xs"
                  >
                    Aplicar filtros
                  </button>
                </div>
                <div className="ml-auto">
                  <button
                    onClick={() => {
                      const csv = toCSV(filteredAuditItems);
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `auditoria_ticket_${auditTicketId}.csv`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="px-3 py-1.5 rounded-md border border-blue-300 text-white bg-blue-600 hover:bg-blue-700 text-xs"
                  >
                    Exportar CSV
                  </button>
                </div>
              </div>
              {auditLoading && <div className="text-sm text-gray-600">Cargando historial...</div>}
              {auditError && <div className="text-sm text-red-600">{auditError}</div>}
              {!auditLoading && !auditError && (
                <div className="flex-1 overflow-y-auto min-h-0 pr-1">
                  <ul className="space-y-2">
                    {filteredAuditItems.length === 0 && (
                      <li className="text-sm text-gray-500">Sin registros de auditoría.</li>
                    )}
                    {filteredAuditItems.map((item) => (
                      <li key={item.id} className="border border-gray-200 rounded-md p-4 text-sm bg-white shadow-sm mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              item.accion === 'CREATE' ? 'bg-green-100 text-green-800' :
                              item.accion === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                              item.accion === 'DELETE' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {friendlyActions[item.accion] || item.accion}
                            </span>
                            <span className="text-gray-500 text-xs">{new Date(item.fecha_accion).toLocaleString()}</span>
                          </div>
                          <button 
                            onClick={() => toggleAuditDetails(item.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            {expandedAuditId === item.id ? 'Ocultar detalles técnicos' : 'Ver detalles técnicos'}
                          </button>
                        </div>
                        
                        <div className="mb-3 text-gray-700">
                          <span className="font-medium">Realizado por:</span> {item.usuario_nombre || item.username || 'Sistema'}
                        </div>

                        {item.accion === 'UPDATE' ? (
                          <div className="bg-gray-50 rounded p-3 border border-gray-100">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cambios realizados</div>
                            <ul className="space-y-2">
                              {computeDiff(item.datos_anteriores, item.datos_nuevos).map((d, idx) => {
                                  if (d.changeType === 'unchanged') return null;
                                  const fieldName = friendlyFieldNames[d.key] || d.key;
                                  return (
                                    <li key={idx} className="text-sm flex flex-col sm:flex-row sm:items-baseline gap-1">
                                      <span className="font-medium text-gray-800 min-w-[120px]">{fieldName}:</span>
                                      <div className="flex-1 flex flex-wrap gap-2 items-center">
                                        <span className="line-through text-red-500 bg-red-50 px-1 rounded">
                                          {formatAuditValue(d.key, d.before)}
                                        </span>
                                        <span className="text-gray-400">→</span>
                                        <span className="text-green-600 bg-green-50 px-1 rounded font-medium">
                                          {formatAuditValue(d.key, d.after)}
                                        </span>
                                      </div>
                                    </li>
                                  );
                              })}
                            </ul>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600 italic">
                            {item.accion === 'CREATE' ? 'Registro creado inicialmente.' : 'Registro eliminado del sistema.'}
                          </div>
                        )}

                        {expandedAuditId === item.id && (
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600 border-t pt-3">
                            {item.datos_anteriores && (
                              <div>
                                <div className="font-semibold mb-1">Datos Anteriores (JSON)</div>
                                <pre className="bg-gray-100 border border-gray-200 rounded p-2 overflow-auto max-h-40">{typeof item.datos_anteriores === 'string' ? item.datos_anteriores : JSON.stringify(item.datos_anteriores, null, 2)}</pre>
                              </div>
                            )}
                            {item.datos_nuevos && (
                              <div>
                                <div className="font-semibold mb-1">Datos Nuevos (JSON)</div>
                                <pre className="bg-gray-100 border border-gray-200 rounded p-2 overflow-auto max-h-40">{typeof item.datos_nuevos === 'string' ? item.datos_nuevos : JSON.stringify(item.datos_nuevos, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-3 flex items-center gap-2 text-xs flex-none pt-2 border-t">
                <button
                  disabled={auditPage <= 1 || auditLoading}
                  onClick={() => fetchAudit(auditTicketId, { page: Math.max(1, auditPage - 1) })}
                  className="px-2 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  ◀︎ Anterior
                </button>
                <span>Página {auditPage}</span>
                <button
                  disabled={auditLoading || filteredAuditItems.length < auditLimit}
                  onClick={() => fetchAudit(auditTicketId, { page: auditPage + 1 })}
                  className="px-2 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Siguiente ▶︎
                </button>
              </div>
            </div>
            <div className="px-4 py-3 border-t flex justify-end flex-none bg-gray-50 md:rounded-b-lg">
              <button onClick={() => setAuditOpen(false)} className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketList;
