import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import TicketList from './components/TicketList';
import TicketDialog from './components/TicketDialog';
import TiposSoporteManager from './components/TiposSoporteManager';
import Login from './components/Login';
import SettingsManager from './components/SettingsManager';
import UsersManager from './components/UsersManager';
import CalendarAgenda from './components/CalendarAgenda';
import { hasPermission } from './permissions';
import { applyFavicon, DEFAULT_BRAND, extractBrandFromImage } from './branding';

// API URL
// En producción, usamos path relativo para que funcione con cualquier IP/dominio
// En desarrollo, el proxy en package.json redirige a localhost:3001
const API_URL = '/api';

// Estados de tickets disponibles
const estadosTicket = ['pendiente', 'resuelto', 'cancelado'];

// UI con Tailwind: sin ThemeProvider ni componentes MUI a nivel de app

function App() {
  const toUpperValue = (value) => String(value || '').toUpperCase();
  // Estados de autenticación
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(localStorage.getItem('token'));
  
  const [tickets, setTickets] = useState([]);
  const [tiposSoporte, setTiposSoporte] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [estadisticas, setEstadisticas] = useState({
    total: 0,
    pendientes: 0,
    resueltos: 0,
    cancelados: 0
  });
  const [showTipos, setShowTipos] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUsersManager, setShowUsersManager] = useState(false);
  const [publicBranding, setPublicBranding] = useState({
    empresaNombre: 'Sistema de Tickets',
    loginSubtitle: '',
    logoUrl: ''
  });
  const [brandPalette, setBrandPalette] = useState(DEFAULT_BRAND);
  const canViewDashboard = hasPermission(user, 'dashboard.view');
  const canViewTickets = hasPermission(user, 'tickets.view');
  const canCreateTickets = hasPermission(user, 'tickets.create');
  const canEditTickets = hasPermission(user, 'tickets.edit');
  const canChangeTicketStatus = hasPermission(user, 'tickets.change_status');
  const canDeleteTickets = hasPermission(user, 'tickets.delete');
  const canViewCalendar = hasPermission(user, 'calendar.view') && canViewTickets;
  const canViewAudit = hasPermission(user, 'audit.view');
  const canViewSupportTypes = hasPermission(user, 'tipos_soporte.view');
  const canManageSupportTypes = hasPermission(user, 'tipos_soporte.manage');
  const canManageSettings = hasPermission(user, 'settings.manage');
  const canManageUsers = hasPermission(user, 'users.manage');
  const canManageRoles = hasPermission(user, 'roles.manage');
  const canOpenUsersManager = canManageUsers || canManageRoles;

  // Filtros de listado
  const [filterEstado, setFilterEstado] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [viewMode, setViewMode] = useState('lista'); // 'lista' | 'calendario'

  // Tickets filtrados por estado y tipo
  const filteredTickets = useMemo(() => {
    let result = tickets;
    if (filterEstado) {
      result = result.filter((t) => t.estado === filterEstado);
    }
    if (filterTipo) {
      result = result.filter((t) => t.tipoSoporte === filterTipo);
    }
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      result = result.filter((t) =>
        (t.cliente && t.cliente.toLowerCase().includes(q)) ||
        (t.telefono && t.telefono.toLowerCase().includes(q))
      );
    }
    return result;
  }, [tickets, filterEstado, filterTipo, filterQuery]);

  // Verificar token al cargar la aplicación
  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await fetch(`${API_URL}/verify-token`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
            setIsAuthenticated(true);
            setAuthToken(token);
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setAuthToken(null);
          }
        } catch (error) {
          console.error('Error verificando token:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setAuthToken(null);
        }
      }
      setLoading(false);
    };

    verifyToken();
  }, []);

  useEffect(() => {
    const fetchPublicConfig = async () => {
      try {
        const response = await fetch(`${API_URL}/config`);
        if (!response.ok) return;
        const data = await response.json();
        applyFavicon(data.faviconUrl || '');
        setPublicBranding({
          empresaNombre: data.empresaNombre || 'Sistema de Tickets',
          loginSubtitle: data.loginSubtitle || '',
          logoUrl: data.logoUrl || ''
        });
      } catch (_) {
        // Ignorar errores de branding
      }
    };

    fetchPublicConfig();
  }, []);

  useEffect(() => {
    if (!publicBranding.logoUrl) {
      setBrandPalette(DEFAULT_BRAND);
      return;
    }

    let cancelled = false;
    extractBrandFromImage(publicBranding.logoUrl).then((palette) => {
      if (!cancelled) {
        setBrandPalette(palette);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [publicBranding.logoUrl]);

  // Función de login
  const handleLogin = async (credentials) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setAuthToken(data.token);
        setUser(data.user);
        setIsAuthenticated(true);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Error al iniciar sesión');
      }
    } catch (error) {
      console.error('Error en login:', error);
      setError('Error de conexión al servidor');
    } finally {
      setLoading(false);
    }
  };

  // Función de logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setTickets([]);
    setTiposSoporte([]);
  };

  // Cargar tickets desde el backend
  const fetchTickets = useCallback(async () => {
    if (!authToken || !canViewTickets) {
      setTickets([]);
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/tickets`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar tickets');
      }
      
      const data = await response.json();
      setTickets(data);
      setError(null);
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cargar tickets. Verifica la conexión al servidor.');
    } finally {
      setLoading(false);
    }
  }, [authToken, canViewTickets]);

  // Cargar tipos de soporte desde el backend
  const fetchTiposSoporte = useCallback(async () => {
    if (!authToken || !canViewSupportTypes) {
      setTiposSoporte([]);
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/tipos-soporte`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar tipos de soporte');
      }
      
      const data = await response.json();
      setTiposSoporte(data.items || data);
    } catch (err) {
      console.error('Error al cargar tipos de soporte:', err);
      // No mostrar error al usuario, usar tipos por defecto si falla
      setTiposSoporte([
        { id: 1, nombre: 'Soporte Técnico' },
        { id: 2, nombre: 'Consulta General' },
        { id: 3, nombre: 'Otro' }
      ]);
    }
  }, [authToken, canViewSupportTypes]);

  // Cargar tickets cuando el usuario esté autenticado
  useEffect(() => {
    if (isAuthenticated && authToken && user) {
      fetchTickets();
      fetchTiposSoporte();
    }
  }, [isAuthenticated, authToken, user, fetchTickets, fetchTiposSoporte]);

  // Cargar tickets al iniciar
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    if (viewMode === 'calendario' && !canViewCalendar) {
      setViewMode('lista');
    }
  }, [viewMode, canViewCalendar]);

  // Actualizar estadísticas cuando cambian los tickets
  useEffect(() => {
    const stats = {
      total: tickets.length,
      pendientes: tickets.filter(t => t.estado === 'pendiente').length,
      resueltos: tickets.filter(t => t.estado === 'resuelto').length,
      cancelados: tickets.filter(t => t.estado === 'cancelado').length
    };
    setEstadisticas(stats);
  }, [tickets]);

  // Abrir diálogo para crear un nuevo ticket
  const handleAddTicket = () => {
    if (!canCreateTickets) return;
    setCurrentTicket(null);
    setOpenDialog(true);
  };

  // Abrir diálogo para editar un ticket existente
  const handleEditTicket = (ticket) => {
    if (!canEditTickets) return;
    setCurrentTicket(ticket);
    setOpenDialog(true);
  };

  // Guardar un ticket (nuevo o editado)
  const handleSaveTicket = async (ticketData) => {
    if (!ticketData?.id && !canCreateTickets) {
      setError('No tienes permiso para crear tickets.');
      return;
    }
    if (ticketData?.id && !canEditTickets) {
      setError('No tienes permiso para editar tickets.');
      return;
    }
    try {
      setLoading(true);
      
      let response;
      
      if (ticketData.id) {
        // Actualizar ticket existente
        response = await fetch(`${API_URL}/tickets/${ticketData.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(ticketData),
        });
      } else {
        // Crear nuevo ticket
        response = await fetch(`${API_URL}/tickets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(ticketData),
        });
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al guardar ticket');
      }
      
      const savedTicket = await response.json();
      
      if (ticketData.id) {
        // Actualizar ticket en la lista
        setTickets(tickets.map(t => t.id === savedTicket.id ? savedTicket : t));
      } else {
        // Añadir nuevo ticket a la lista
        setTickets([savedTicket, ...tickets]);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Error al guardar ticket. Verifica la conexión al servidor.');
    } finally {
      setLoading(false);
      setOpenDialog(false);
    }
  };

  // Actualizar el estado de un ticket (incluye motivo de cancelación)
  const handleUpdateStatus = async (id, nuevoEstado, motivoCancelacion) => {
    if (!canChangeTicketStatus) {
      setError('No tienes permiso para cambiar el estado de tickets.');
      return;
    }
    try {
      setLoading(true);
      
      const response = await fetch(`${API_URL}/tickets/${id}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(
          nuevoEstado === 'cancelado'
            ? { estado: nuevoEstado, motivo_cancelacion: (motivoCancelacion || '').trim() }
            : { estado: nuevoEstado }
        ),
      });
      
      if (!response.ok) {
        let serverMsg = 'Error al actualizar estado';
        try {
          const data = await response.json();
          if (data && data.error) serverMsg = data.error;
        } catch (_) {}
        throw new Error(serverMsg);
      }
      
      const updatedTicket = await response.json();
      setTickets(tickets.map(t => t.id === updatedTicket.id ? updatedTicket : t));
      setError(null);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Error al actualizar estado. Verifica la conexión al servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar un ticket
  const handleDeleteTicket = async (id) => {
    if (!canDeleteTickets) {
      setError('No tienes permiso para eliminar tickets.');
      return;
    }
    try {
      setLoading(true);
      
      const response = await fetch(`${API_URL}/tickets/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al eliminar ticket');
      }
      
      setTickets(tickets.filter(t => t.id !== id));
      setError(null);
    } catch (err) {
      console.error('Error:', err);
      setError('Error al eliminar ticket. Verifica la conexión al servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Cerrar alerta de error
  const handleCloseError = () => {
    setError(null);
  };

  return (
    <>
      {!isAuthenticated ? (
        <Login onLogin={handleLogin} loading={loading} error={error} apiUrl={API_URL} />
      ) : (
        <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
          <header className="flex-none z-10 border-b border-slate-200/80 bg-white shadow-sm">
            <div
              className="h-1 w-full"
              style={{
                background: `linear-gradient(90deg, ${brandPalette.primary}, ${brandPalette.deep})`
              }}
            />
            <div className="w-full mx-auto px-4 py-3 md:px-6">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {publicBranding.logoUrl ? (
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
                      <img src={publicBranding.logoUrl} alt="Logo" className="max-h-10 max-w-10 object-contain" />
                    </div>
                  ) : (
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold shadow-sm"
                      style={{ backgroundColor: brandPalette.primary, color: brandPalette.textOnPrimary }}
                    >
                      TS
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-lg font-semibold tracking-tight text-slate-900">
                      {publicBranding.empresaNombre || 'Sistema de Tickets'}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
                        style={{
                          backgroundColor: brandPalette.soft,
                          color: brandPalette.deep
                        }}
                      >
                        Plataforma activa
                      </span>
                      <span className="truncate">
                        {publicBranding.loginSubtitle || 'Gestión centralizada de tickets'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    Bienvenido, <span className="font-semibold text-slate-800">{user?.nombre || user?.user?.nombre}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
              {canManageSupportTypes && (
                <button
                  onClick={() => setShowTipos(true)}
                  className="w-full sm:w-auto text-sm px-3 py-2 rounded-xl text-white transition"
                  style={{ backgroundColor: brandPalette.primary, boxShadow: `0 10px 24px ${brandPalette.softer}` }}
                >
                  Tipos de Soporte
                </button>
              )}
              {canManageSettings && (
                <button onClick={() => setShowSettings(true)} className="w-full sm:w-auto text-sm px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition">
                  Configuración
                </button>
              )}
              <button onClick={handleLogout} className="w-full sm:w-auto text-sm px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition">
                Cerrar Sesión
              </button>
                  </div>
                </div>
              </div>
            </div>
          </header>
          
          <main className="flex-1 flex flex-col min-h-0 overflow-y-auto md:overflow-hidden">
            <div className="w-full mx-auto mt-4 mb-4 px-3 sm:px-6 flex flex-col min-h-full md:h-full md:min-h-0">
              {canViewDashboard && (
              <div className="flex-none mb-4">
                <Dashboard 
                  estadisticas={estadisticas} 
                  onAddTicket={handleAddTicket} 
                  canCreateTicket={canCreateTickets}
                  brandPalette={brandPalette}
                />
              </div>
              )}
              
              <div className="flex flex-col bg-white rounded-lg shadow relative overflow-visible md:flex-1 md:min-h-0 md:overflow-hidden">
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-20">
                    <div className="h-6 w-6 rounded-full border-4 border-gray-300 border-t-transparent animate-spin" />
                  </div>
                )}
                
                <div className="p-4 flex-none border-b border-gray-100">
                  {/* Filtros por tipo y estado */}
                  <div className="flex flex-col md:flex-row md:items-end gap-3">
                    <div className="flex-1 min-w-full md:min-w-[220px]">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                      <input
                        type="text"
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(toUpperValue(e.target.value))}
                        placeholder="Nombre del cliente o teléfono"
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                      <div className="flex-1 md:flex-none">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                        <select
                          value={filterEstado}
                          onChange={(e) => setFilterEstado(e.target.value)}
                          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">Todos</option>
                          {estadosTicket.map((estado) => (
                            <option key={estado} value={estado}>
                              {estado.charAt(0).toUpperCase() + estado.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 md:flex-none">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Soporte</label>
                        <select
                          value={filterTipo}
                          onChange={(e) => setFilterTipo(e.target.value)}
                          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">Todos</option>
                          {tiposSoporte.map((tipo) => (
                            <option key={tipo.id} value={tipo.nombre}>{tipo.nombre}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {(filterEstado || filterTipo || filterQuery) && (
                      <button
                        type="button"
                        onClick={() => { setFilterEstado(''); setFilterTipo(''); setFilterQuery(''); }}
                        className="w-full md:w-auto rounded-md border border-gray-300 bg-gray-100 text-gray-700 px-3 py-2 text-sm hover:bg-gray-200"
                      >
                        Limpiar filtros
                      </button>
                    )}
                    <div className="ml-0 md:ml-auto w-full md:w-auto">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vista</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setViewMode('lista')}
                          disabled={!canViewTickets}
                          className={`flex-1 md:flex-none rounded-xl border px-3 py-2 text-sm transition ${viewMode === 'lista' ? '' : 'bg-gray-100 text-gray-700 border-gray-300'}`}
                          style={viewMode === 'lista'
                            ? {
                                backgroundColor: brandPalette.primary,
                                color: brandPalette.textOnPrimary,
                                borderColor: brandPalette.deep,
                                boxShadow: `0 10px 24px ${brandPalette.softer}`
                              }
                            : undefined}
                        >
                          Lista
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('calendario')}
                          disabled={!canViewCalendar}
                          className={`flex-1 md:flex-none rounded-xl border px-3 py-2 text-sm transition ${viewMode === 'calendario' ? '' : 'bg-gray-100 text-gray-700 border-gray-300'}`}
                          style={viewMode === 'calendario'
                            ? {
                                backgroundColor: brandPalette.primary,
                                color: brandPalette.textOnPrimary,
                                borderColor: brandPalette.deep,
                                boxShadow: `0 10px 24px ${brandPalette.softer}`
                              }
                            : undefined}
                        >
                          Calendario
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative overflow-visible md:flex-1 md:overflow-hidden">
                  {!canViewTickets ? (
                    <div className="min-h-[240px] md:h-full flex items-center justify-center p-6 text-center text-gray-500">
                      No tienes permisos para ver tickets con este rol.
                    </div>
                  ) : viewMode === 'lista' ? (
                    <div className="relative md:absolute md:inset-0 overflow-visible md:overflow-hidden">
                      <TicketList 
                        tickets={filteredTickets} 
                        estados={estadosTicket}
                        onEditTicket={handleEditTicket}
                        onUpdateStatus={handleUpdateStatus}
                        onDeleteTicket={handleDeleteTicket}
                        apiUrl={API_URL}
                        brandPalette={brandPalette}
                        permissions={{
                          canEditTickets,
                          canChangeTicketStatus,
                          canDeleteTickets,
                          canViewAudit
                        }}
                      />
                    </div>
                  ) : (
                    <div className="min-h-[320px] md:h-full overflow-visible md:overflow-auto p-4">
                      <CalendarAgenda 
                        tickets={filteredTickets}
                        onSelectTicket={handleEditTicket}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
          
          <TicketDialog 
            open={openDialog}
            ticket={currentTicket}
            tiposSoporte={tiposSoporte}
            onClose={() => setOpenDialog(false)}
            onSave={handleSaveTicket}
            loading={loading}
            brandPalette={brandPalette}
          />

          {showTipos && canManageSupportTypes && (
            <TiposSoporteManager apiUrl={API_URL} onClose={() => setShowTipos(false)} brandPalette={brandPalette} />
          )}
              {isAuthenticated && canOpenUsersManager && (
                <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
                  <button
                    onClick={() => setShowUsersManager(true)}
                    className="rounded-full shadow-lg text-white px-3 py-2 sm:px-4 text-xs sm:text-sm transition"
                    style={{
                      backgroundColor: brandPalette.primary,
                      boxShadow: `0 16px 36px ${brandPalette.softer}`
                    }}
                    title="Gestionar usuarios"
                  >
                    Usuarios
                  </button>
                </div>
              )}
              {showSettings && (
                <SettingsManager apiUrl={API_URL} onClose={() => setShowSettings(false)} brandPalette={brandPalette} />
              )}
              {showUsersManager && (
                <UsersManager apiUrl={API_URL} onClose={() => setShowUsersManager(false)} currentUser={user} brandPalette={brandPalette} />
              )}
          
          {error && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 max-w-lg w-full px-4">
              <div className="bg-red-600 text-white px-4 py-3 rounded-md shadow flex items-start justify-between">
                <div className="mr-3">{error}</div>
                <button onClick={handleCloseError} className="text-white/90 hover:text-white">✕</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default App;
