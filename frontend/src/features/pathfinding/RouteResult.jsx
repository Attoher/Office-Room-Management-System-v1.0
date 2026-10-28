import { AlertTriangle, ArrowUpDown, CheckCircle2, ChevronRight, Unlink } from 'lucide-react';
import { formatPercent } from '../../domain/occupancy';

const STATUS_VIEW = {
  aman: {
    icon: CheckCircle2,
    title: 'Jalur aman ditemukan',
    className: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  },
  penuh: {
    icon: AlertTriangle,
    title: 'Jalur terhalang ruangan penuh',
    className: 'bg-red-50 text-red-800 ring-red-600/20',
  },
  'tidak-ada-jalur': {
    icon: Unlink,
    title: 'Tidak ada pintu yang menyambungkan kedua ruangan',
    className: 'bg-slate-50 text-slate-700 ring-slate-600/20',
  },
};

const formatMeters = (value) => `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })} m`;

function RoutePath({ route, roomsById, floorName }) {
  return (
    <ol className="flex flex-wrap items-center gap-1">
      {route.roomIds.map((id, index) => {
        const room = roomsById.get(id);
        const previous = index > 0 ? roomsById.get(route.roomIds[index - 1]) : null;
        const changesFloor = previous && previous.lantai_id !== room.lantai_id;
        return (
          <li key={id} className="flex items-center gap-1">
            {index > 0 &&
              (changesFloor ? (
                <span className="flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white">
                  <ArrowUpDown className="size-3" aria-hidden />
                  {floorName(room.lantai_id)}
                </span>
              ) : (
                <ChevronRight className="size-4 text-slate-400" aria-hidden />
              ))}
            <span
              className={`rounded-md px-2 py-1 text-sm ${
                route.blockedRoomIds.includes(id)
                  ? 'bg-red-100 font-medium text-red-700 line-through'
                  : 'bg-white text-slate-800 ring-1 ring-inset ring-slate-200'
              }`}
            >
              {room.nama_ruangan}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function RouteResult({ plan, roomsById, floors, selectedIndex, onSelect }) {
  const view = STATUS_VIEW[plan.status];
  const Icon = view.icon;
  const selected = plan.routes[selectedIndex];
  const floorName = (id) => floors.find((f) => f.id === id)?.nama ?? '?';
  const blockedNames = (plan.bestRoute?.blockedRoomIds ?? [])
    .map((id) => roomsById.get(id)?.nama_ruangan)
    .join(', ');

  return (
    <div className="space-y-4">
      <div className={`flex items-start gap-3 rounded-lg p-3 ring-1 ring-inset ${view.className}`}>
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold">{view.title}</p>
          {plan.status === 'penuh' && <p className="mt-0.5">Ruangan penuh: {blockedNames}</p>}
        </div>
      </div>

      {selected && (
        <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">
              {selectedIndex === 0 ? 'Jalur rekomendasi' : `Alternatif ${selectedIndex}`}
            </p>
            <p className="text-xs text-slate-500">
              <span className="text-base font-semibold text-slate-900">
                {formatMeters(selected.length)}
              </span>{' '}
              · {selected.roomIds.length - 1} pintu
              {selected.floorChanges > 0 && ` · ${selected.floorChanges}× pindah lantai`} ·
              rata-rata isi {formatPercent(selected.averageOccupancy * 100)}
            </p>
          </div>
          <RoutePath route={selected} roomsById={roomsById} floorName={floorName} />
        </div>
      )}

      {plan.routes.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">
            Pilihan jalur ({plan.routes.length})
          </p>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {plan.routes.map((route, index) => (
              <li key={route.roomIds.join('-')}>
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    index === selectedIndex
                      ? 'bg-blue-50 ring-1 ring-inset ring-blue-200'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="w-6 shrink-0 text-xs font-medium text-slate-400">
                    #{index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-700">
                    {route.roomIds.map((id) => roomsById.get(id)?.nama_ruangan).join(' → ')}
                  </span>
                  {route.blockedRoomIds.length > 0 && (
                    <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                      terhalang
                    </span>
                  )}
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">
                    {formatMeters(route.length)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
