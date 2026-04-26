import React from 'react';

// Componente para mostrar una tarjeta de estadística
// ... existing code ...
// Componente para mostrar una tarjeta de estadística
const StatCard = ({ title, value, color }) => (
  <div
    className="bg-white rounded-md shadow p-3 h-24 border-t-4"
    style={{ borderTopColor: color }}
  >
    <div className="text-sm text-gray-500 mb-1">{title}</div>
    <div className="text-2xl font-semibold text-gray-800">{value}</div>
  </div>
);
// ... existing code ...

// Componente principal del Dashboard
const Dashboard = ({ estadisticas, onAddTicket, canCreateTicket = true }) => {
  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
        {canCreateTicket && (
          <button
            onClick={onAddTicket}
            className="inline-flex items-center rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5"
          >
            <span className="text-lg mr-2">+</span>
            Nuevo Ticket
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard title="Total de Tickets" value={estadisticas.total} color="#2196f3" />
        <StatCard title="Pendientes" value={estadisticas.pendientes} color="#ff9800" />
        <StatCard title="Resueltos" value={estadisticas.resueltos} color="#4caf50" />
        <StatCard title="Cancelados" value={estadisticas.cancelados} color="#f44336" />
      </div>
    </div>
  );
};

export default Dashboard;
