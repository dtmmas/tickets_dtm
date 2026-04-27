import React, { useState, useEffect } from 'react';
import { DEFAULT_BRAND } from '../branding';
import { toDateTimeLocalInput } from '../datetime';
import LocationPickerMap from './LocationPickerMap';
// Migrado a Tailwind: sin dependencias de MUI

const isValidLatitude = (value) => value !== '' && !Number.isNaN(Number(value)) && Number(value) >= -90 && Number(value) <= 90;
const isValidLongitude = (value) => value !== '' && !Number.isNaN(Number(value)) && Number(value) >= -180 && Number(value) <= 180;
const hasCoordinates = (latitud, longitud) => isValidLatitude(latitud) && isValidLongitude(longitud);
const buildExternalMapUrl = (latitud, longitud) =>
  `https://www.google.com/maps?q=${encodeURIComponent(`${latitud},${longitud}`)}&t=k`;

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
    fechaProgramada: '',
    latitud: '',
    longitud: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [locationError, setLocationError] = useState('');
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [showLocationSection, setShowLocationSection] = useState(false);
  
  // Cargar datos del ticket si se está editando
  useEffect(() => {
    if (ticket) {
      const ticketHasCoordinates = hasCoordinates(ticket.latitud, ticket.longitud);
      setFormData(prev => ({
        ...prev,
        ...ticket,
        fechaProgramada: toDateTimeLocalInput(ticket.fechaProgramada),
        latitud: ticket.latitud ?? '',
        longitud: ticket.longitud ?? ''
      }));
      setShowLocationSection(ticketHasCoordinates);
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
        fechaProgramada: '',
        latitud: '',
        longitud: ''
      });
      setShowLocationSection(false);
    }
    setFormErrors({});
    setLocationError('');
    setCapturingLocation(false);
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
      case 'latitud':
      case 'longitud': {
        return String(value).replace(/[^0-9.-]/g, '');
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
      case 'latitud':
        if (!v.trim() && !String(formData.longitud || '').trim()) return '';
        if (!v.trim()) return 'Ingrese también la latitud';
        if (!isValidLatitude(v)) return 'La latitud debe estar entre -90 y 90';
        return '';
      case 'longitud':
        if (!v.trim() && !String(formData.latitud || '').trim()) return '';
        if (!v.trim()) return 'Ingrese también la longitud';
        if (!isValidLongitude(v)) return 'La longitud debe estar entre -180 y 180';
        return '';
      default:
        return '';
    }
  };

  // Manejar cambios en los campos del formulario con sanitización y validación
  const handleChange = (e) => {
    const { name, value } = e.target;
    const sanitized = sanitizeValue(name, value);
    setFormData(prev => {
      const next = { ...prev, [name]: sanitized };
      setFormErrors(errors => ({
        ...errors,
        [name]: validateField(name, sanitized),
        ...(name === 'latitud' ? { longitud: validateField('longitud', next.longitud) } : {}),
        ...(name === 'longitud' ? { latitud: validateField('latitud', next.latitud) } : {})
      }));
      return next;
    });
    if (name === 'latitud' || name === 'longitud') {
      setLocationError('');
    }
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
      !validateField('descripcion', formData.descripcion) &&
      !validateField('latitud', formData.latitud) &&
      !validateField('longitud', formData.longitud)
    );
    const noErrors = Object.values(formErrors).every(v => !v);
    return requiredOk && patternsOk && noErrors;
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Este dispositivo no permite obtener la ubicación actual.');
      return;
    }

    setCapturingLocation(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLatitud = position.coords.latitude.toFixed(7);
        const nextLongitud = position.coords.longitude.toFixed(7);
        setFormData(prev => ({
          ...prev,
          latitud: nextLatitud,
          longitud: nextLongitud
        }));
        setFormErrors(prev => ({
          ...prev,
          latitud: '',
          longitud: ''
        }));
        setCapturingLocation(false);
      },
      () => {
        setCapturingLocation(false);
        setLocationError('No fue posible obtener la ubicación. Verifique permisos de GPS o ingrésela manualmente.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleMapCoordinatesChange = (latitud, longitud) => {
    setFormData(prev => ({
      ...prev,
      latitud,
      longitud
    }));
    setFormErrors(prev => ({
      ...prev,
      latitud: '',
      longitud: ''
    }));
    setLocationError('');
    setShowLocationSection(true);
  };

  const handleToggleLocationSection = () => {
    setShowLocationSection((prev) => !prev);
  };

  const handleClearLocation = () => {
    setFormData((prev) => ({
      ...prev,
      latitud: '',
      longitud: ''
    }));
    setFormErrors((prev) => ({
      ...prev,
      latitud: '',
      longitud: ''
    }));
    setLocationError('');
    setShowLocationSection(false);
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
      payload.latitud = payload.latitud === '' ? null : Number(payload.latitud);
      payload.longitud = payload.longitud === '' ? null : Number(payload.longitud);
      // Si fechaProgramada viene del input datetime-local, enviar tal cual
      onSave(payload);
    }
  };

  const isResolved = Boolean(ticket && (ticket.estado === 'resuelto' || ticket.estado === 'cancelado'));
  const showMapPreview = hasCoordinates(formData.latitud, formData.longitud);

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
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={handleToggleLocationSection}
                      disabled={loading || isResolved}
                      className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-slate-300 disabled:opacity-60"
                    >
                      <span
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white"
                        style={{
                          backgroundColor: brandPalette.primary,
                          boxShadow: `0 10px 24px ${brandPalette.softer}`
                        }}
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 21s7-5.686 7-11a7 7 0 10-14 0c0 5.314 7 11 7 11z" />
                          <circle cx="12" cy="10" r="2.5" strokeWidth="2" />
                        </svg>
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-700">
                          {showLocationSection ? 'Ocultar ubicación del cliente' : 'Agregar ubicación del cliente'}
                        </span>
                        <span className="block text-xs text-slate-500">
                          Opción opcional. Solo úsela si desea marcar el punto en el mapa.
                        </span>
                      </span>
                    </button>
                    {showMapPreview && (
                      <button
                        type="button"
                        onClick={handleClearLocation}
                        disabled={loading || isResolved}
                        className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        Quitar ubicación
                      </button>
                    )}
                  </div>

                  {showLocationSection && (
                    <div className="mt-4 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-[#5a6c7d] font-medium text-sm">Ubicación del cliente</div>
                          <p className="text-xs text-slate-500 mt-1">Puede ingresar coordenadas manualmente, capturar la ubicación actual o marcar el punto directamente en el mapa.</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleUseCurrentLocation}
                          disabled={loading || isResolved || capturingLocation}
                          className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                          style={{
                            backgroundColor: brandPalette.primary,
                            boxShadow: `0 10px 24px ${brandPalette.softer}`
                          }}
                        >
                          {capturingLocation ? 'Obteniendo GPS...' : 'Usar ubicación actual'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <div className="mb-2 text-[#5a6c7d] font-medium text-sm">Latitud</div>
                          <input
                            type="text"
                            name="latitud"
                            value={formData.latitud}
                            onChange={handleChange}
                            disabled={loading || isResolved}
                            inputMode="decimal"
                            placeholder="Ej. 14.6349150"
                            className="w-full rounded-xl bg-white border border-slate-200 px-3 py-3 placeholder-gray-400 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                          />
                          {formErrors.latitud && (
                            <p className="text-xs text-red-600 mt-1">{formErrors.latitud}</p>
                          )}
                        </div>
                        <div>
                          <div className="mb-2 text-[#5a6c7d] font-medium text-sm">Longitud</div>
                          <input
                            type="text"
                            name="longitud"
                            value={formData.longitud}
                            onChange={handleChange}
                            disabled={loading || isResolved}
                            inputMode="decimal"
                            placeholder="Ej. -90.5068820"
                            className="w-full rounded-xl bg-white border border-slate-200 px-3 py-3 placeholder-gray-400 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                          />
                          {formErrors.longitud && (
                            <p className="text-xs text-red-600 mt-1">{formErrors.longitud}</p>
                          )}
                        </div>
                      </div>
                      {locationError && (
                        <p className="text-xs text-red-600">{locationError}</p>
                      )}
                      <LocationPickerMap
                        latitud={formData.latitud}
                        longitud={formData.longitud}
                        onChange={handleMapCoordinatesChange}
                        disabled={loading || isResolved}
                      />
                      <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          {showMapPreview
                            ? `Punto seleccionado: ${formData.latitud}, ${formData.longitud}`
                            : 'Puede marcar el punto directamente en el mapa o escribir las coordenadas manualmente.'}
                        </span>
                        {showMapPreview && (
                          <a
                            href={buildExternalMapUrl(formData.latitud, formData.longitud)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold"
                            style={{ color: brandPalette.deep }}
                          >
                            Abrir en Google Maps
                          </a>
                        )}
                      </div>
                    </div>
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
