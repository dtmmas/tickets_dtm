import React, { useState, useEffect } from 'react';
import { DEFAULT_BRAND } from '../branding';
// Migrado a Tailwind: sin dependencias de MUI

// Componente para el diálogo de creación/edición de tickets
const TicketDialog = ({ open, ticket, tiposSoporte, onClose, onSave, loading, brandPalette = DEFAULT_BRAND }) => {
  // Estado para los datos del formulario
  const [formData, setFormData] = useState({
    id: null,
    cliente: '',
    direccion: '',
    telefono: '',
    descripcion: '',
    tipoSoporte: '',
    estado: 'pendiente',
    fechaProgramada: ''
  });
  const [formErrors, setFormErrors] = useState({});
  
  // Normalizar valor para input datetime-local desde fecha existente
  const toInputDateTime = (val) => {
    if (!val) return '';
    try {
      // Si ya viene en formato compatible (contiene T), intentar usarlo
      if (typeof val === 'string' && val.includes('T') && val.length >= 16) {
         // Podría ser ISO, cortar para el input (YYYY-MM-DDThh:mm)
         return val.substring(0, 16);
      }

      const d = new Date(val);
      if (isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mi = pad(d.getMinutes());
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    } catch (_) {
      return '';
    }
  };

  // Cargar datos del ticket si se está editando
  useEffect(() => {
    if (ticket) {
      setFormData(prev => ({
        ...prev,
        ...ticket,
        fechaProgramada: toInputDateTime(ticket.fechaProgramada) // Inicializar ya formateado
      }));
    } else {
      // Resetear formulario si es un nuevo ticket
      setFormData({
        id: null,
        cliente: '',
        direccion: '',
        telefono: '',
        descripcion: '',
        tipoSoporte: '',
        estado: 'pendiente',
        fechaProgramada: ''
      });
    }
  }, [ticket, open]);
  
  // Sanitizar por campo y validar
  const sanitizeValue = (name, value) => {
    if (value == null) return '';
    switch (name) {
      case 'cliente': {
        const upper = value.toUpperCase();
        return upper.replace(/[^A-ZÁÉÍÓÚÑÜ\s]/g, '');
      }
      case 'direccion': {
        const upper = value.toUpperCase();
        return upper.replace(/[^A-ZÁÉÍÓÚÑÜ0-9#\-/\s]/g, '');
      }
      case 'descripcion': {
        const upper = value.toUpperCase();
        return upper.replace(/[^A-ZÁÉÍÓÚÑÜ0-9.,;:()#\-\s]/g, '');
      }
      case 'telefono': {
        return String(value).replace(/\D/g, '');
      }
      default:
        return value;
    }
  };

  const validateField = (name, value) => {
    const v = value || '';
    switch (name) {
      case 'cliente':
        if (!v.trim()) return 'El nombre es obligatorio';
        if (!/^[A-ZÁÉÍÓÚÑÜ ]+$/.test(v)) return 'Solo letras y espacios';
        return '';
      case 'telefono':
        if (!v.trim()) return 'El teléfono es obligatorio';
        if (!/^[0-9]{7,15}$/.test(v)) return 'Debe tener 7 a 15 dígitos';
        return '';
      case 'direccion':
        if (!v.trim()) return 'La dirección es obligatoria';
        return '';
      case 'tipoSoporte':
        if (!v.trim()) return 'Seleccione el tipo de soporte';
        return '';
      case 'descripcion':
        if (!v.trim()) return 'La descripción es obligatoria';
        return '';
      default:
        return '';
    }
  };

  // Manejar cambios en los campos del formulario con sanitización y validación
  const handleChange = (e) => {
    const { name, value } = e.target;
    const sanitized = sanitizeValue(name, value);
    setFormData(prev => ({ ...prev, [name]: sanitized }));
    setFormErrors(prev => ({ ...prev, [name]: validateField(name, sanitized) }));
  };
  
  // Validar formulario antes de guardar
  const isFormValid = () => {
    const requiredOk = (
      formData.cliente.trim() !== '' &&
      formData.direccion.trim() !== '' &&
      formData.telefono.trim() !== '' &&
      formData.descripcion.trim() !== '' &&
      formData.tipoSoporte.trim() !== ''
    );
    const patternsOk = (
      !validateField('cliente', formData.cliente) &&
      !validateField('telefono', formData.telefono) &&
      !validateField('direccion', formData.direccion) &&
      !validateField('tipoSoporte', formData.tipoSoporte) &&
      !validateField('descripcion', formData.descripcion)
    );
    const noErrors = Object.values(formErrors).every(v => !v);
    return requiredOk && patternsOk && noErrors;
  };
  
  // Guardar ticket
  const handleSave = () => {
    if (isFormValid()) {
      const payload = { ...formData };
      
      // Restricción: Si la fecha está vacía pero el ticket original tenía fecha, mantener la original
      // Esto evita borrar accidentalmente la fecha programada
      if (!payload.fechaProgramada && ticket && ticket.fechaProgramada) {
        payload.fechaProgramada = ticket.fechaProgramada;
      }

      // Removido flujo de cobro/pago: enviar solo datos básicos
      delete payload.precio;
      delete payload.pago;
      delete payload.cobro_aplica;
      // Si fechaProgramada viene del input datetime-local, enviar tal cual
      onSave(payload);
    }
  };

  const isResolved = Boolean(ticket && (ticket.estado === 'resuelto' || ticket.estado === 'cancelado'));

  return (
    open ? (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative z-10 flex h-full items-start justify-center overflow-y-auto px-3 py-3 sm:items-center sm:px-4 sm:py-6">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-2xl border border-slate-200 overflow-hidden max-h-[calc(100vh-1.5rem)] flex flex-col sm:max-h-[calc(100vh-3rem)]">
            <div
              className="h-1.5 w-full rounded-t-2xl"
              style={{ background: `linear-gradient(90deg, ${brandPalette.primary}, ${brandPalette.deep})` }}
            />
            <div className="pb-1 pt-4 px-4 sm:px-6 text-left flex items-start justify-between gap-4 flex-none">
              <div>
                <div
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] mb-2"
                  style={{ backgroundColor: brandPalette.soft, color: brandPalette.deep }}
                >
                  {ticket ? 'Edicion' : 'Creacion'}
                </div>
                <div className="text-[1.5rem] font-semibold text-[#2c3e50]">
                  {ticket ? 'Editar Ticket' : 'Nuevo Ticket'}
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  {ticket ? 'Actualiza la informacion del servicio con la misma identidad visual del sistema.' : 'Registra un nuevo requerimiento con la imagen corporativa activa.'}
                </div>
              </div>
              <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
                ✕
              </button>
            </div>
            <div className="px-4 sm:px-6 pt-4 pb-4 overflow-y-auto min-h-0 flex-1">
              <div className="max-w-[500px] mx-auto space-y-5 sm:space-y-6">
                <div>
                  <div className="mb-2 text-[#5a6c7d] font-medium text-sm">Nombre</div>
                  <input
                    type="text"
                    name="cliente"
                    value={formData.cliente}
                    onChange={handleChange}
                    required
                    disabled={loading || isResolved}
                    placeholder="Ingrese el nombre del cliente"
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 placeholder-gray-400 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                  {formErrors.cliente && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.cliente}</p>
                  )}
                </div>
                <div>
                  <div className="mb-2 text-[#5a6c7d] font-medium text-sm">Fecha programada</div>
                  <input
                    type="datetime-local"
                    name="fechaProgramada"
                    value={formData.fechaProgramada || ''}
                    onChange={handleChange}
                    disabled={loading || isResolved}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 placeholder-gray-400 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                  />
                  <p className="text-xs text-gray-500 mt-1">Opcional. Agenda la fecha en que se resolverá/realizará el ticket.</p>
                </div>
                <div>
                  <div className="mb-2 text-[#5a6c7d] font-medium text-sm">Teléfono</div>
                  <input
                    type="tel"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    inputMode="numeric"
                    required
                    placeholder="Ingrese el número de teléfono"
                    disabled={loading || isResolved}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 placeholder-gray-400 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                  />
                  {formErrors.telefono && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.telefono}</p>
                  )}
                </div>
                <div>
                  <div className="mb-2 text-[#5a6c7d] font-medium text-sm">Dirección</div>
                  <input
                    type="text"
                    name="direccion"
                    value={formData.direccion}
                    onChange={handleChange}
                    required
                    disabled={loading || isResolved}
                    placeholder="Ingrese la dirección"
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 placeholder-gray-400 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                  />
                  {formErrors.direccion && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.direccion}</p>
                  )}
                </div>
                <div>
                  <div className="mb-2 text-[#5a6c7d] font-medium text-sm">Tipo de Soporte</div>
                  <select
                    name="tipoSoporte"
                    value={formData.tipoSoporte}
                    onChange={handleChange}
                    required
                    disabled={loading || isResolved}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-gray-700 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                  >
                    <option value="" className="text-gray-400">Seleccione el tipo de soporte</option>
                    {tiposSoporte.map((tipo) => (
                      <option key={tipo.id} value={tipo.nombre}>{tipo.nombre}</option>
                    ))}
                  </select>
                  {formErrors.tipoSoporte && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.tipoSoporte}</p>
                  )}
                </div>
                <div>
                  <div className="mb-2 text-[#5a6c7d] font-medium text-sm">Descripción</div>
                  <textarea
                    name="descripcion"
                    value={formData.descripcion}
                    onChange={handleChange}
                    rows={4}
                    required
                    disabled={loading || isResolved}
                    placeholder="Describa el problema detalladamente"
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 placeholder-gray-400 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200 resize-y disabled:opacity-60"
                  />
                  {formErrors.descripcion && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.descripcion}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="px-4 pb-4 pt-3 flex flex-col gap-2 sm:flex-row sm:justify-end sm:items-center border-t border-slate-100 flex-none">
              {isResolved && (
                <div
                  className="sm:mr-auto rounded-full px-3 py-1 text-xs font-semibold text-center"
                  style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                >
                  Este ticket esta resuelto. No se puede editar.
                </div>
              )}
              <button 
                type="button"
                onClick={onClose}
                disabled={loading}
                className="w-full sm:w-auto rounded-xl font-semibold px-4 py-2 text-gray-700 border border-gray-300 bg-gray-100 hover:bg-gray-200 hover:border-gray-400 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSave}
                disabled={!isFormValid() || loading || isResolved}
                className="w-full sm:w-auto rounded-xl font-semibold px-4 py-2 text-white disabled:bg-gray-400"
                style={{
                  backgroundColor: !isFormValid() || loading || isResolved ? undefined : brandPalette.primary,
                  boxShadow: !isFormValid() || loading || isResolved ? undefined : `0 12px 28px ${brandPalette.softer}`
                }}
              >
                {loading ? 'Guardando...' : (ticket ? (isResolved ? 'No editable' : 'Actualizar Ticket') : 'Agregar Ticket')}
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : null
  );
};

export default TicketDialog;
