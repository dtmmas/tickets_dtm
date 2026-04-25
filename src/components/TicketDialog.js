import React, { useState, useEffect } from 'react';
// Migrado a Tailwind: sin dependencias de MUI

// Componente para el diálogo de creación/edición de tickets
const TicketDialog = ({ open, ticket, tiposSoporte, onClose, onSave, loading }) => {
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
        return upper.replace(/[^A-ZÁÉÍÓÚÑÜ0-9#\-\/\s]/g, '');
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
        <div className="relative z-10 flex items-center justify-center h-full px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg overflow-visible">
            <div className="pb-1 pt-4 px-6 text-left">
              <div className="text-[1.5rem] font-semibold text-[#2c3e50]">
                {ticket ? 'Editar Ticket' : 'Nuevo Ticket'}
              </div>
              {/* Campos de cobro/pago removidos */}
            </div>
            <div className="px-6 pt-4 pb-4 min-h-[500px]">
              <div className="max-w-[500px] mx-auto space-y-6">
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
                    className="w-full rounded-md bg-gray-100 border border-gray-200 px-3 py-3 placeholder-gray-400 hover:bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
                    className="w-full rounded-md bg-gray-100 border border-gray-200 px-3 py-3 placeholder-gray-400 hover:bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-60"
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
                    className="w-full rounded-md bg-gray-100 border border-gray-200 px-3 py-3 placeholder-gray-400 hover:bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-60"
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
                    className="w-full rounded-md bg-gray-100 border border-gray-200 px-3 py-3 placeholder-gray-400 hover:bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-60"
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
                    className="w-full rounded-md bg-gray-100 border border-gray-200 px-3 py-3 text-gray-700 hover:bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-60"
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
                    className="w-full rounded-md bg-gray-100 border border-gray-200 px-3 py-3 placeholder-gray-400 hover:bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-y disabled:opacity-60"
                  />
                  {formErrors.descripcion && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.descripcion}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="px-4 pb-4 pt-3 flex gap-2 justify-end">
              {isResolved && (
                <div className="px-6 -mt-2 text-sm text-amber-700">Este ticket está resuelto. No se puede editar.</div>
              )}
              <button 
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-md font-semibold px-4 py-2 text-gray-700 border border-gray-300 bg-gray-100 hover:bg-gray-200 hover:border-gray-400 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSave}
                disabled={!isFormValid() || loading || isResolved}
                className="rounded-md font-semibold px-4 py-2 text-white bg-[#00bcd4] hover:bg-[#0097a7] disabled:bg-gray-400"
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
