import React from 'react';

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const getWeeks = (current) => {
  const start = startOfMonth(current);
  const end = endOfMonth(current);
  const startDay = new Date(start);
  startDay.setDate(start.getDate() - start.getDay()); // domingo inicio
  const endDay = new Date(end);
  endDay.setDate(end.getDate() + (6 - end.getDay())); // sábado fin
  const days = [];
  const d = new Date(startDay);
  while (d <= endDay) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
};

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const CalendarAgenda = ({ tickets, onSelectTicket }) => {
  const [current, setCurrent] = React.useState(new Date());

  const ticketsByDay = React.useMemo(() => {
    const map = new Map();
    tickets.forEach(t => {
      if (!t.fechaProgramada) return;
      const d = new Date(t.fechaProgramada);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
    return map;
  }, [tickets]);

  const weeks = getWeeks(current);

  const prevMonth = () => setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  const nextMonth = () => setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1));

  const monthName = current.toLocaleString('es-ES', { month: 'long' });

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-lg font-semibold capitalize">Agenda: {monthName} {current.getFullYear()}</div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="rounded-md border border-gray-300 bg-gray-100 text-gray-700 px-3 py-1.5 text-sm hover:bg-gray-200">Mes anterior</button>
          <button onClick={nextMonth} className="rounded-md border border-gray-300 bg-gray-100 text-gray-700 px-3 py-1.5 text-sm hover:bg-gray-200">Mes siguiente</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => (
          <div key={d} className="text-center text-sm font-medium text-gray-600 py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2 border border-gray-200 rounded-md p-2 bg-white">
        {weeks.map((week, wi) => (
          <React.Fragment key={wi}>
            {week.map((day, di) => {
              const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
              const items = ticketsByDay.get(key) || [];
              const inMonth = day.getMonth() === current.getMonth();
              return (
                <div key={di} className={`min-h-[110px] rounded-md border ${inMonth ? 'border-gray-200 bg-gray-50' : 'border-transparent bg-white'} p-2`}> 
                  <div className={`text-xs ${sameDay(day, new Date()) ? 'font-bold text-indigo-700' : 'text-gray-600'}`}>{day.getDate()}</div>
                  {items.length > 0 ? (
                    <div className="mt-1 space-y-1">
                      {items.slice(0,3).map(it => (
                        <button
                          key={it.id}
                          onClick={() => onSelectTicket && onSelectTicket(it)}
                          className="block w-full text-left text-xs px-2 py-1 rounded-md bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
                          title={`${it.cliente} • ${it.tipoSoporte}`}
                        >
                          #{it.id} {it.cliente}
                        </button>
                      ))}
                      {items.length > 3 && (
                        <div className="text-[10px] text-gray-500">+{items.length - 3} más</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-400 mt-2">Sin tickets</div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default CalendarAgenda;

