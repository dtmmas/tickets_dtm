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
import { applyFavicon } from './branding';

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
      } catch (_) {
        // Ignorar errores de branding
      }
    };

    fetchPublicConfig();
  }, []);

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
          <header className="bg-white border-b border-gray-200 flex-none z-10">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center">
              <div className="font-semibold text-lg text-gray-800 flex-1">Sistema de Tickets de Soporte DTM Jacaltenango</div>
              <div className="text-sm text-gray-600 mr-4">Bienvenido, {user?.nombre || user?.user?.nombre}</div>
              {canManageSupportTypes && (
                <button onClick={() => setShowTipos(true)} className="text-sm px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white mr-3">
                  Tipos de Soporte
                </button>
              )}
              {canManageSettings && (
                <button onClick={() => setShowSettings(true)} className="text-sm px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white mr-3">
                  Configuración
                </button>
              )}
              <button onClick={handleLogout} className="text-sm px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300">
                Cerrar Sesión
              </button>
            </div>
          </header>
          
          <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="w-full mx-auto mt-4 mb-4 px-6 flex flex-col h-full min-h-0">
              {canViewDashboard && (
              <div className="flex-none mb-4">
                <Dashboard 
                  estadisticas={estadisticas} 
                  onAddTicket={handleAddTicket} 
                  canCreateTicket={canCreateTickets}
                />
              </div>
              )}
              
              <div className="flex-1 flex flex-col min-h-0 bg-white rounded-lg shadow overflow-hidden relative">
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
                    <div className="flex gap-3 w-full md:w-auto">
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
                          className={`flex-1 md:flex-none rounded-md border px-3 py-2 text-sm ${viewMode==='lista' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-gray-100 text-gray-700 border-gray-300'}`}
                        >
                          Lista
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('calendario')}
                          disabled={!canViewCalendar}
                          className={`flex-1 md:flex-none rounded-md border px-3 py-2 text-sm ${viewMode==='calendario' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-gray-100 text-gray-700 border-gray-300'}`}
                        >
                          Calendario
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden relative">
                  {!canViewTickets ? (
                    <div className="h-full flex items-center justify-center p-6 text-center text-gray-500">
                      No tienes permisos para ver tickets con este rol.
                    </div>
                  ) : viewMode === 'lista' ? (
                    <div className="absolute inset-0 overflow-hidden">
                      <TicketList 
                        tickets={filteredTickets} 
                        estados={estadosTicket}
                        onEditTicket={handleEditTicket}
                        onUpdateStatus={handleUpdateStatus}
                        onDeleteTicket={handleDeleteTicket}
                        apiUrl={API_URL}
                        permissions={{
                          canEditTickets,
                          canChangeTicketStatus,
                          canDeleteTickets,
                          canViewAudit
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-full overflow-auto p-4">
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
          />

          {showTipos && canManageSupportTypes && (
            <TiposSoporteManager apiUrl={API_URL} onClose={() => setShowTipos(false)} />
          )}
              {isAuthenticated && canOpenUsersManager && (
                <div className="fixed bottom-6 right-6 z-40">
                  <button
                    onClick={() => setShowUsersManager(true)}
                    className="rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm"
                    title="Gestionar usuarios"
                  >
                    Usuarios
                  </button>
                </div>
              )}
              {showSettings && (
                <SettingsManager apiUrl={API_URL} onClose={() => setShowSettings(false)} />
              )}
              {showUsersManager && (
                <UsersManager apiUrl={API_URL} onClose={() => setShowUsersManager(false)} currentUser={user} />
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
