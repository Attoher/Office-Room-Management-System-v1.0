import { Building2, Link2, Users } from 'lucide-react';
import { STATUS_META, STATUS_ORDER, formatPercent } from '../../domain/occupancy';

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function StatsPanel({ summary, connectionCount }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={Building2} label="Ruangan" value={summary.totalRooms} />
      <Stat
        icon={Users}
        label="Orang di kantor"
        value={summary.totalOccupancy}
        hint={`dari kapasitas ${summary.totalCapacity}`}
      />
      <Stat
        icon={Users}
        label="Rata-rata occupancy"
        value={formatPercent(summary.averagePercent)}
      />
      <Stat icon={Link2} label="Koneksi" value={connectionCount} />

      <div className="col-span-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-4">
        <p className="text-sm text-slate-500">Sebaran status</p>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100">
          {STATUS_ORDER.map((key) =>
            summary.byStatus[key] > 0 ? (
              <div
                key={key}
                className={STATUS_META[key].bar}
                style={{ width: `${(summary.byStatus[key] / summary.totalRooms) * 100}%` }}
              />
            ) : null,
          )}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {STATUS_ORDER.map((key) => (
            <li key={key} className="flex items-center gap-2 text-slate-600">
              <span className={`size-2 rounded-full ${STATUS_META[key].dot}`} aria-hidden />
              {STATUS_META[key].label} ({STATUS_META[key].range})
              <span className="font-semibold tabular-nums text-slate-900">
                {summary.byStatus[key]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
