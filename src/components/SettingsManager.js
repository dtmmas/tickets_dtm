import React from 'react';
import { applyFavicon, DEFAULT_BRAND } from '../branding';

const SettingsManager = ({ apiUrl, onClose, brandPalette = DEFAULT_BRAND }) => {
  const toUpperValue = (value) => String(value || '').toUpperCase();
  const [empresaNombre, setEmpresaNombre] = React.useState('');
  const [loginSubtitle, setLoginSubtitle] = React.useState('');
  const [logoUrl, setLogoUrl] = React.useState('');
  const [logoFile, setLogoFile] = React.useState(null);
  const [faviconUrl, setFaviconUrl] = React.useState('');
  const [faviconFile, setFaviconFile] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [showConfirmSave, setShowConfirmSave] = React.useState(false);
  const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
  const MAX_FAVICON_SIZE = 1024 * 1024; // 1MB

  const token = localStorage.getItem('token');

  const fetchConfig = React.useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const resp = await fetch(`${apiUrl}/config`);
      const data = await resp.json();
      setEmpresaNombre(data.empresaNombre || '');
      setLoginSubtitle(data.loginSubtitle || '');
      setLogoUrl(data.logoUrl || '');
      setFaviconUrl(data.faviconUrl || '');
    } catch (e) {
      setError('No fue posible cargar la configuración');
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  React.useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const performSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      // Si hay archivo de logo seleccionado, convertirlo a dataUrl
      let dataUrl;
      let faviconDataUrl;
      if (logoFile) {
        if (!['image/png', 'image/jpeg'].includes(logoFile.type)) {
          throw new Error('Formato no soportado. Use PNG o JPG');
        }
        if (logoFile.size > MAX_LOGO_SIZE) {
          throw new Error('La imagen excede el límite de 2MB');
        }
        dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
          reader.readAsDataURL(logoFile);
        });
      }
      if (faviconFile) {
        if (!['image/png', 'image/x-icon', 'image/vnd.microsoft.icon'].includes(faviconFile.type)) {
          throw new Error('El favicon debe ser PNG o ICO');
        }
        if (faviconFile.size > MAX_FAVICON_SIZE) {
          throw new Error('El favicon excede el límite de 1MB');
        }
        faviconDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('No se pudo leer el favicon'));
          reader.readAsDataURL(faviconFile);
        });
      }
      const resp = await fetch(`${apiUrl}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ empresaNombre, loginSubtitle, dataUrl, faviconDataUrl })
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || 'Error al guardar configuración');
      }
      const data = await resp.json();
      setEmpresaNombre(data.empresaNombre || empresaNombre);
      setLoginSubtitle(data.loginSubtitle || loginSubtitle);
      if (data.logoUrl) {
        setLogoUrl(data.logoUrl);
        setLogoFile(null);
      }
      if (data.faviconUrl) {
        setFaviconUrl(data.faviconUrl);
        setFaviconFile(null);
        applyFavicon(data.faviconUrl);
      }
      setSuccess('Configuracion guardada correctamente');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setShowConfirmSave(false);
    }
  };

  const handleSaveTexts = (e) => {
    e?.preventDefault?.();
    setShowConfirmSave(true);
  };

  const handleSelectLogo = (file) => {
    if (!file) { setLogoFile(null); return; }
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setError('Formato no soportado. Use PNG o JPG');
      setSuccess('');
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setError('La imagen excede el límite de 2MB');
      setSuccess('');
      return;
    }
    setError('');
    setSuccess('');
    setLogoFile(file);
  };

  const handleSelectFavicon = (file) => {
    if (!file) { setFaviconFile(null); return; }
    if (!['image/png', 'image/x-icon', 'image/vnd.microsoft.icon'].includes(file.type)) {
      setError('El favicon debe ser PNG o ICO');
      setSuccess('');
      return;
    }
    if (file.size > MAX_FAVICON_SIZE) {
      setError('El favicon excede el límite de 1MB');
      setSuccess('');
      return;
    }
    setError('');
    setSuccess('');
    setFaviconFile(file);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex items-center justify-center h-full px-4">
        <div className="bg-white rounded-2xl shadow-lg w-full max-w-screen-sm md:max-w-2xl overflow-visible border border-slate-200">
          <div
            className="h-1.5 w-full rounded-t-2xl"
            style={{ background: `linear-gradient(90deg, ${brandPalette.primary}, ${brandPalette.deep})` }}
          />
          <div className="pb-1 pt-4 px-4 md:px-6 text-left flex items-center justify-between">
            <div>
              <div
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] mb-2"
                style={{ backgroundColor: brandPalette.soft, color: brandPalette.deep }}
              >
                Branding
              </div>
              <div className="text-[1.5rem] font-semibold text-[#2c3e50]">Configuración</div>
            </div>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
          </div>
          <div className="px-4 md:px-6 pt-4 pb-4">
            {error && <div className="bg-red-600 text-white px-3 py-2 rounded mb-3 text-sm">{error}</div>}
              {success && <div className="bg-green-600 text-white px-3 py-2 rounded mb-3 text-sm">{success}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Logo de la empresa</h3>
                <div className="border rounded p-3">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="max-h-24 object-contain mx-auto mb-3" />
                  ) : (
                    <div className="text-center text-gray-500 text-sm mb-3">Sin logo</div>
                  )}
                  <input type="file" accept="image/png,image/jpeg" onChange={(e)=>handleSelectLogo(e.target.files[0])} className="w-full text-sm" />
                  <p className="text-xs text-gray-500 mt-1">Formatos permitidos: PNG, JPG</p>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Icono de la pestaña</h3>
                <div className="border rounded p-3 mb-4">
                  {faviconUrl ? (
                    <img src={faviconUrl} alt="Favicon" className="h-10 w-10 object-contain mx-auto mb-3" />
                  ) : (
                    <div className="text-center text-gray-500 text-sm mb-3">Sin favicon</div>
                  )}
                  <input type="file" accept="image/png,.ico,image/x-icon" onChange={(e)=>handleSelectFavicon(e.target.files[0])} className="w-full text-sm" />
                  <p className="text-xs text-gray-500 mt-1">Formatos permitidos: PNG o ICO. Recomendado: 32x32 o 64x64.</p>
                </div>
              </div>
              <div className="md:col-span-2">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Textos del login</h3>
                <form onSubmit={handleSaveTexts} className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nombre de la empresa</label>
                    <input value={empresaNombre} onChange={(e)=>{ setEmpresaNombre(toUpperValue(e.target.value)); setSuccess(''); }} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Subtítulo del login</label>
                    <input value={loginSubtitle} onChange={(e)=>{ setLoginSubtitle(toUpperValue(e.target.value)); setSuccess(''); }} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-md text-white px-3 py-1.5 text-sm"
                      style={{ backgroundColor: brandPalette.primary, boxShadow: `0 10px 24px ${brandPalette.softer}` }}
                    >
                      Guardar
                    </button>
                    <button type="button" onClick={fetchConfig} disabled={loading} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">Recargar</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showConfirmSave && (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !loading && setShowConfirmSave(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-5 border border-slate-200">
            <div className="text-lg font-semibold text-gray-800 mb-2">Confirmar cambios</div>
            <p className="text-sm text-gray-600 mb-4">
              Se guardarán los cambios de configuración, incluyendo textos, logo e icono de la pestaña.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmSave(false)}
                disabled={loading}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={performSave}
                disabled={loading}
                className="rounded-md text-white px-3 py-1.5 text-sm"
                style={{ backgroundColor: brandPalette.primary }}
              >
                {loading ? 'Guardando...' : 'Sí, guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsManager;
