import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TicketList from './TicketList';

const sampleTickets = [
  {
    id: 1,
    cliente: 'Juan Pérez',
    telefono: '555-1234',
    descripcion: 'Problema con el internet',
    tipoSoporte: 'Soporte Técnico',
    estado: 'resuelto',
    fechaCreacion: new Date().toISOString(),
  }
];

const estados = ['pendiente', 'resuelto', 'cancelado'];

test('muestra modal de confirmación con detalles al eliminar', () => {
  const onEditTicket = jest.fn();
  const onUpdateStatus = jest.fn();
  const onDeleteTicket = jest.fn();

  render(
    <TicketList
      tickets={sampleTickets}
      estados={estados}
      onEditTicket={onEditTicket}
      onUpdateStatus={onUpdateStatus}
      onDeleteTicket={onDeleteTicket}
      apiUrl={'/api'}
    />
  );

  const deleteButton = screen.getByRole('button', { name: /eliminar/i });
  fireEvent.click(deleteButton);

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText(/¿Seguro que deseas eliminar este ticket?/i)).toBeInTheDocument();
  expect(screen.getByText(/Problema con el internet/i)).toBeInTheDocument();
});

test('bloquea transición no permitida y muestra aviso', () => {
  const onEditTicket = jest.fn();
  const onUpdateStatus = jest.fn();
  const onDeleteTicket = jest.fn();

  render(
    <TicketList
      tickets={sampleTickets}
      estados={estados}
      onEditTicket={onEditTicket}
      onUpdateStatus={onUpdateStatus}
      onDeleteTicket={onDeleteTicket}
      apiUrl={'http://localhost:3001/api'}
    />
  );

  const select = screen.getByDisplayValue(/resuelto/i);
  fireEvent.change(select, { target: { value: 'pendiente' } });

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText(/Transición no permitida/i)).toBeInTheDocument();
});

test('abre panel de auditoría, filtra por acción y exporta CSV', async () => {
  const onEditTicket = jest.fn();
  const onUpdateStatus = jest.fn();
  const onDeleteTicket = jest.fn();

  // Mock de fetch para auditoría
  const auditData = [
    { id: 10, accion: 'CREATE', usuario_nombre: 'Usuario Demo', username: 'usuario1', fecha_accion: new Date().toISOString(), datos_nuevos: { cliente: 'Juan Pérez', estado: 'pendiente' } },
    { id: 11, accion: 'UPDATE', usuario_nombre: 'Técnico Principal', username: 'tecnico1', fecha_accion: new Date().toISOString(), datos_anteriores: { estado: 'pendiente' }, datos_nuevos: { estado: 'resuelto' } },
    { id: 12, accion: 'DELETE', usuario_nombre: 'Usuario Demo', username: 'usuario1', fecha_accion: new Date().toISOString(), datos_anteriores: { estado: 'resuelto' } }
  ];
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(auditData) }));

  // Mocks para exportación CSV
  const createObjectURLMock = jest.fn(() => 'blob:mock');
  const revokeObjectURLMock = jest.fn();
  global.URL.createObjectURL = createObjectURLMock;
  global.URL.revokeObjectURL = revokeObjectURLMock;
  const appendSpy = jest.spyOn(document.body, 'appendChild');

  render(
    <TicketList
      tickets={sampleTickets}
      estados={estados}
      onEditTicket={onEditTicket}
      onUpdateStatus={onUpdateStatus}
      onDeleteTicket={onDeleteTicket}
      apiUrl={'http://localhost:3001/api'}
    />
  );

  // Abrir panel de auditoría
  const auditButton = screen.getByRole('button', { name: /historial/i });
  fireEvent.click(auditButton);
  expect(await screen.findByText(/Historial de auditoría/i)).toBeInTheDocument();

  // Filtrar por acción UPDATE
  const accionSelect = screen.getByLabelText(/Acción/i);
  fireEvent.change(accionSelect, { target: { value: 'UPDATE' } });
  // Debe mostrar solo la entrada UPDATE
  expect(screen.getByText(/UPDATE/i)).toBeInTheDocument();
  expect(screen.queryByText(/CREATE/i)).not.toBeInTheDocument();

  // Exportar CSV
  const exportBtn = screen.getByRole('button', { name: /Exportar CSV/i });
  fireEvent.click(exportBtn);
  expect(createObjectURLMock).toHaveBeenCalled();
  expect(appendSpy).toHaveBeenCalled();
  const appendedAnchor = appendSpy.mock.calls[0][0];
  expect(appendedAnchor.download).toMatch(/auditoria_ticket_1\.csv/);
});

test('búsqueda por usuario y colores de diffs en UPDATE', async () => {
  const onEditTicket = jest.fn();
  const onUpdateStatus = jest.fn();
  const onDeleteTicket = jest.fn();

  const auditData = [
    { id: 21, accion: 'UPDATE', usuario_nombre: 'Técnico Principal', username: 'tecnico1', fecha_accion: new Date().toISOString(), datos_anteriores: { estado: 'pendiente' }, datos_nuevos: { estado: 'resuelto' } },
    { id: 22, accion: 'UPDATE', usuario_nombre: 'Usuario Demo', username: 'usuario1', fecha_accion: new Date().toISOString(), datos_anteriores: { telefono: '555-1234' }, datos_nuevos: { telefono: '555-5678' } }
  ];
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(auditData) }));

  render(
    <TicketList
      tickets={sampleTickets}
      estados={estados}
      onEditTicket={onEditTicket}
      onUpdateStatus={onUpdateStatus}
      onDeleteTicket={onDeleteTicket}
      apiUrl={'http://localhost:3001/api'}
    />
  );

  const auditButton = screen.getByRole('button', { name: /historial/i });
  fireEvent.click(auditButton);
  expect(await screen.findByText(/Historial de auditoría/i)).toBeInTheDocument();

  // Buscar por usuario técnico
  const usuarioInput = screen.getByPlaceholderText(/Buscar por usuario/i);
  fireEvent.change(usuarioInput, { target: { value: 'tecnico' } });
  // Debe aparecer el técnico y no el usuario demo
  expect(screen.getByText(/Técnico Principal/i)).toBeInTheDocument();
  expect(screen.queryByText(/Usuario Demo/i)).not.toBeInTheDocument();

  // Verificar color para cambio de estado (changed -> amber)
  const estadoLabel = screen.getByText(/estado:/i);
  expect(estadoLabel.closest('li')).toHaveClass('text-amber-700');
});

test('paginación en panel de auditoría (siguiente página carga nuevos items)', async () => {
  const onEditTicket = jest.fn();
  const onUpdateStatus = jest.fn();
  const onDeleteTicket = jest.fn();

  const page1 = { items: [ { id: 31, accion: 'CREATE', usuario_nombre: 'Usuario Demo', username: 'usuario1', fecha_accion: new Date().toISOString(), datos_nuevos: { cliente: 'Juan' } } ], meta: { total: 2, page: 1, limit: 1 } };
  const page2 = { items: [ { id: 32, accion: 'DELETE', usuario_nombre: 'Técnico Principal', username: 'tecnico1', fecha_accion: new Date().toISOString(), datos_anteriores: { cliente: 'Juan' } } ], meta: { total: 2, page: 2, limit: 1 } };
  global.fetch = jest.fn((url) => {
    if (String(url).includes('page=2')) return Promise.resolve({ ok: true, json: () => Promise.resolve(page2) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(page1) });
  });

  render(
    <TicketList
      tickets={sampleTickets}
      estados={estados}
      onEditTicket={onEditTicket}
      onUpdateStatus={onUpdateStatus}
      onDeleteTicket={onDeleteTicket}
      apiUrl={'http://localhost:3001/api'}
    />
  );

  const auditButton = screen.getByRole('button', { name: /historial/i });
  fireEvent.click(auditButton);
  expect(await screen.findByText(/Historial de auditoría/i)).toBeInTheDocument();

  // Página 1
  expect(screen.getByText(/Página 1/i)).toBeInTheDocument();
  expect(screen.getByText(/CREATE/i)).toBeInTheDocument();

  // Ir a página 2
  const nextBtn = screen.getByRole('button', { name: /Siguiente/i });
  fireEvent.click(nextBtn);

  // Página 2
  expect(await screen.findByText(/Página 2/i)).toBeInTheDocument();
  expect(screen.getByText(/DELETE/i)).toBeInTheDocument();
});
