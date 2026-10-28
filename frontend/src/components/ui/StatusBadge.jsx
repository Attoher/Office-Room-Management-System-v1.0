import {
  STATUS_META,
  formatPercent,
  getOccupancyPercent,
  getOccupancyStatus,
} from '../../domain/occupancy';

export function StatusBadge({ room }) {
  const meta = STATUS_META[getOccupancyStatus(room)];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.badge}`}
    >
      <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label} · {formatPercent(getOccupancyPercent(room))}
    </span>
  );
}

export function OccupancyBar({ room }) {
  const meta = STATUS_META[getOccupancyStatus(room)];
  const percent = Math.min(100, getOccupancyPercent(room));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all ${meta.bar}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function StatusLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {Object.values(STATUS_META).map((meta) => (
        <li key={meta.label} className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden />
          {meta.label} ({meta.range})
        </li>
      ))}
    </ul>
  );
}
