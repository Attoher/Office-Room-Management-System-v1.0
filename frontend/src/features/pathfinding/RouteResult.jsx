import { AlertTriangle, CheckCircle2, ChevronRight, Unlink } from 'lucide-react';
import { formatPercent } from '../../domain/occupancy';

const STATUS_VIEW = {
  aman: {
    icon: CheckCircle2,
    title: 'Jalur aman ditemukan',
    className: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  },
  penuh: {
    icon: AlertTriangle,
    title: 'Semua jalur melewati ruangan penuh',
    className: 'bg-red-50 text-red-800 ring-red-600/20',
  },
  'tidak-ada-jalur': {
    icon: Unlink,
    title: 'Tidak ada jalur yang menghubungkan kedua ruangan',
    className: 'bg-slate-50 text-slate-700 ring-slate-600/20',
  },
};

function RoutePath({ roomIds, blockedRoomIds, roomsById }) {
  return (
    <ol className="flex flex-wrap items-center gap-1">
      {roomIds.map((id, index) => (
        <li key={id} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="size-4 text-slate-400" aria-hidden />}
          <span
            className={`rounded-md px-2 py-1 text-sm ${
              blockedRoomIds.includes(id)
                ? 'bg-red-100 font-medium text-red-700 line-through'
                : 'bg-white text-slate-800 ring-1 ring-inset ring-slate-200'
            }`}
          >
            {roomsById.get(id)?.nama_ruangan}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function RouteResult({ plan, roomsById, selectedIndex, onSelect }) {
  const view = STATUS_VIEW[plan.status];
  const Icon = view.icon;
  const selected = plan.routes[selectedIndex];

  return (
    <div className="space-y-4">
      <div className={`flex items-start gap-3 rounded-lg p-3 ring-1 ring-inset ${view.className}`}>
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold">{view.title}</p>
          {plan.status === 'penuh' && (
            <p className="mt-0.5">
              Ruangan penuh:{' '}
              {plan.bestRoute.blockedRoomIds
                .map((id) => roomsById.get(id)?.nama_ruangan)
                .join(', ')}
            </p>
          )}
        </div>
      </div>

      {selected && (
        <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">
              {selectedIndex === 0 ? 'Jalur rekomendasi' : `Alternatif ${selectedIndex}`}
            </p>
            <p className="text-xs text-slate-500">
              {selected.hops} langkah · rata-rata isi{' '}
              {formatPercent(selected.averageOccupancy * 100)} · skor {selected.score}
            </p>
          </div>
          <RoutePath
            roomIds={selected.roomIds}
            blockedRoomIds={selected.blockedRoomIds}
            roomsById={roomsById}
          />
        </div>
      )}

      {plan.routes.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">
            Semua kemungkinan jalur ({plan.routes.length})
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
                    skor {route.score}
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
