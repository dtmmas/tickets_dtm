import React, { useState, useEffect } from 'react';

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

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const resp = await fetch(`${apiUrl}/config`);
        if (!resp.ok) return; // Silencioso si falla
        const data = await resp.json();
        setEmpresaNombre(data.empresaNombre || '');
        setLoginSubtitle(data.loginSubtitle || '');
        setLogoUrl(data.logoUrl || '');
      } catch (e) {
        // Ignorar errores de carga de config
      }
    };
    if (apiUrl) fetchConfig();
  }, [apiUrl]);

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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="mx-auto mb-4 max-h-16 object-contain" />
        ) : (
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-indigo-600 flex items-center justify-center text-white">🔒</div>
        )}
        {empresaNombre && (
          <div className="text-lg font-semibold mb-1 text-gray-800 text-center">{empresaNombre}</div>
        )}
        <h1 className="text-xl font-semibold mb-2 text-gray-800 text-center">Iniciar Sesión</h1>
        <p className="text-sm text-gray-500 mb-4 text-center">{loginSubtitle || 'Sistema de Tickets'}</p>

        {error && (
          <div className="bg-red-600 text-white px-3 py-2 rounded mb-3 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Nombre de Usuario</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              value={formData.username}
              onChange={handleChange}
              disabled={loading}
              className="w-full rounded-md bg-gray-100 border border-gray-300 px-3 py-2 placeholder-gray-400 hover:bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            {formErrors.username && (
              <p className="text-xs text-red-600 mt-1">{formErrors.username}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                className="w-full rounded-md bg-gray-100 border border-gray-300 px-3 py-2 placeholder-gray-400 hover:bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none pr-10"
              />
              <button
                type="button"
                onClick={handleTogglePasswordVisibility}
                disabled={loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                aria-label="toggle password visibility"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {formErrors.password && (
              <p className="text-xs text-red-600 mt-1">{formErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo-600 text-white py-2 font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-flex items-center"><span className="h-4 w-4 mr-2 rounded-full border-2 border-white/70 border-t-transparent animate-spin"></span>Iniciando...</span>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        <div className="mt-4 text-center text-gray-500 text-sm">
          <div>Usuarios de prueba:</div>
          <div className="text-xs">admin / tecnico1 / usuario1</div>
          <div className="text-xs">Contraseña: password123</div>
        </div>
      </div>
    </div>
  );
};

export default Login;