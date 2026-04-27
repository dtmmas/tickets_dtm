import React, { useState, useEffect } from 'react';
import { applyFavicon, DEFAULT_BRAND, extractBrandFromImage } from '../branding';

const Login = ({ onLogin, loading, error, apiUrl }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [empresaNombre, setEmpresaNombre] = useState('');
  const [loginSubtitle, setLoginSubtitle] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brand, setBrand] = useState(DEFAULT_BRAND);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const resp = await fetch(`${apiUrl}/config`);
        if (!resp.ok) return; // Silencioso si falla
        const data = await resp.json();
        setEmpresaNombre(data.empresaNombre || '');
        setLoginSubtitle(data.loginSubtitle || '');
        setLogoUrl(data.logoUrl || '');
        applyFavicon(data.faviconUrl || '');
      } catch (e) {
        // Ignorar errores de carga de config
      }
    };
    if (apiUrl) fetchConfig();
  }, [apiUrl]);

  useEffect(() => {
    if (!logoUrl) {
      setBrand(DEFAULT_BRAND);
      return;
    }

    let cancelled = false;
    extractBrandFromImage(logoUrl).then((palette) => {
      if (!cancelled) {
        setBrand(palette);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Limpiar errores cuando el usuario empiece a escribir
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.username.trim()) {
      errors.username = 'El nombre de usuario es requerido';
    }
    
    if (!formData.password) {
      errors.password = 'La contraseña es requerida';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      onLogin(formData);
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 flex items-center justify-center px-4 py-8">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at top, ${brand.glowA}, transparent 32%), radial-gradient(circle at bottom right, ${brand.glowB}, transparent 26%)`
        }}
      />
      <div className="absolute -top-20 -left-16 h-56 w-56 rounded-full blur-3xl" style={{ backgroundColor: brand.soft }} />
      <div className="absolute -bottom-24 -right-12 h-64 w-64 rounded-full blur-3xl" style={{ backgroundColor: brand.softer }} />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-[28px] border border-white/10 bg-white/95 shadow-2xl shadow-slate-900/30 backdrop-blur-xl overflow-hidden">
          <div className="px-6 pt-6 pb-5 sm:px-8 border-b border-slate-200/80">
            <div
              className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{
                border: `1px solid ${brand.softer}`,
                backgroundColor: brand.soft,
                color: brand.deep
              }}
            >
              Acceso seguro
            </div>
            <div className="mt-5 flex items-center gap-4">
              {logoUrl ? (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden">
                  <img src={logoUrl} alt="Logo" className="max-h-12 max-w-[52px] object-contain" />
                </div>
              ) : (
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl text-lg font-semibold shadow-sm"
                  style={{ backgroundColor: brand.primary, color: brand.textOnPrimary }}
                >
                  TS
                </div>
              )}
              <div className="min-w-0">
                {empresaNombre && (
                  <div className="text-xl font-semibold tracking-tight text-slate-900">
                    {empresaNombre}
                  </div>
                )}
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Iniciar sesión</h1>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  {loginSubtitle || 'Sistema de Tickets'}
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8">
            {error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Usuario
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={formData.username}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 placeholder-slate-400 transition focus:bg-white focus:outline-none disabled:opacity-60"
                  style={{
                    boxShadow: 'none'
                  }}
                  placeholder="Ingresa tu usuario"
                />
                {formErrors.username && (
                  <p className="mt-1.5 text-xs text-red-600">{formErrors.username}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-24 text-slate-800 placeholder-slate-400 transition focus:bg-white focus:outline-none disabled:opacity-60"
                    style={{
                      boxShadow: 'none'
                    }}
                    placeholder="Ingresa tu contraseña"
                  />
                  <button
                    type="button"
                    onClick={handleTogglePasswordVisibility}
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                    aria-label="Mostrar u ocultar contraseña"
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                {formErrors.password && (
                  <p className="mt-1.5 text-xs text-red-600">{formErrors.password}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl px-4 py-3 text-sm font-semibold transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundColor: brand.primary,
                  color: brand.textOnPrimary,
                  boxShadow: `0 12px 30px ${brand.softer}`
                }}
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center">
                    <span className="mr-2 h-4 w-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin"></span>
                    Iniciando...
                  </span>
                ) : (
                  'Entrar al sistema'
                )}
              </button>
            </form>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
              Accede con tus credenciales asignadas por el administrador del sistema.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
