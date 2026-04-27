import React from 'react';

const StatCard = ({ title, value, color, accent }) => (
  <div
    className="rounded-2xl border bg-white/95 shadow-sm p-4 h-28"
    style={{
      borderColor: accent || 'rgba(226, 232, 240, 1)',
      boxShadow: accent ? `0 12px 28px ${accent}` : undefined
    }}
  >
    <div className="flex items-center gap-2 mb-3">
      <span
        className="inline-flex h-3 w-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div className="text-sm font-medium text-gray-500">{title}</div>
    </div>
    <div className="text-3xl font-semibold text-gray-800">{value}</div>
  </div>
);

// Componente principal del Dashboard
const Dashboard = ({ estadisticas, onAddTicket, canCreateTicket = true, brandPalette }) => {
  const totalAccent = brandPalette?.softer || 'rgba(59, 130, 246, 0.15)';
  const totalColor = brandPalette?.primary || '#2196f3';

  return (
    <div className="mt-2">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <div
            className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{
              backgroundColor: brandPalette?.soft || 'rgba(79, 70, 229, 0.10)',
              color: brandPalette?.deep || '#3730a3'
            }}
          >
            Resumen general
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-800">Dashboard</h1>
        </div>
        {canCreateTicket && (
          <button
            onClick={onAddTicket}
            className="inline-flex items-center justify-center rounded-2xl text-white px-4 py-2.5 text-sm font-semibold transition"
            style={{
              backgroundColor: brandPalette?.primary || '#4f46e5',
              boxShadow: `0 12px 30px ${brandPalette?.softer || 'rgba(79, 70, 229, 0.18)'}`
            }}
          >
            <span className="text-lg mr-2">+</span>
            Nuevo Ticket
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard title="Total de Tickets" value={estadisticas.total} color={totalColor} accent={totalAccent} />
        <StatCard title="Pendientes" value={estadisticas.pendientes} color="#f59e0b" accent="rgba(245, 158, 11, 0.12)" />
        <StatCard title="Resueltos" value={estadisticas.resueltos} color="#22c55e" accent="rgba(34, 197, 94, 0.12)" />
        <StatCard title="Cancelados" value={estadisticas.cancelados} color="#ef4444" accent="rgba(239, 68, 68, 0.12)" />
      </div>
    </div>
  );
};

export default Dashboard;
