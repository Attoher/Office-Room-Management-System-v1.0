import { ArrowRight, Building2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import {
  STATUS_ORDER,
  formatPercent,
  getOccupancyPercent,
  getOccupancyStatus,
  statusMeta,
  summarizeRooms,
} from '../../domain/occupancy';

const MAX_CHANGES = 6;

function StatusBar({ byStatus, total, meta }) {
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
      {STATUS_ORDER.map((key) =>
        byStatus[key] > 0 ? (
          <div
            key={key}
            className={meta[key].bar}
            style={{ width: `${(byStatus[key] / total) * 100}%` }}
          />
        ) : null,
      )}
    </div>
  );
}

function Counts({ byStatus, meta }) {
  return (
    <span className="flex gap-3 text-xs tabular-nums">
      {STATUS_ORDER.map((key) => (
        <span key={key} className={`flex items-center gap-1 ${meta[key].text}`}>
          <span className={`size-1.5 rounded-full ${meta[key].dot}`} aria-hidden />
          {byStatus[key]}
        </span>
      ))}
    </span>
  );
}

/**
 * Sebaran status ruangan semua kantor menurut batas yang sedang diisi (`preview`), dibandingkan
 * dengan aturan yang berlaku (`current`), beserta ruangan yang statusnya berubah.
 */
export default function StatusImpact({ offices, floors, rooms, current, preview }) {
  const meta = statusMeta(preview);
  const currentMeta = statusMeta(current);
  // Lantai lama tanpa office_id dianggap milik kantor pertama (sama dengan useActiveOffice)
  const floorOffice = new Map(floors.map((f) => [f.id, f.office_id ?? offices[0]?.id]));
  const total = summarizeRooms(rooms, preview);

  const perOffice = offices
    .map((office) => {
      const officeRooms = rooms.filter((r) => floorOffice.get(r.lantai_id) === office.id);
      return { office, count: officeRooms.length, ...summarizeRooms(officeRooms, preview) };
    })
    .filter((o) => o.count > 0);

  const changes = rooms
    .map((room) => ({
      room,
      from: getOccupancyStatus(room, current),
      to: getOccupancyStatus(room, preview),
    }))
    .filter((c) => c.from !== c.to)
    .sort((a, b) => getOccupancyPercent(b.room) - getOccupancyPercent(a.room));

  return (
    <Card>
      <CardHeader
        title="Dampak ke ruangan"
        description="Sebaran status saat ini menurut batas di samping, sebelum disimpan."
      />
      <CardBody className="space-y-5">
        {rooms.length === 0 ? (
          <EmptyState icon={Building2} title="Belum ada ruangan" />
        ) : (
          <>
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">
                  Semua kantor{' '}
                  <span className="font-normal text-slate-500">· {total.totalRooms} ruangan</span>
                </p>
                <Counts byStatus={total.byStatus} meta={meta} />
              </div>
              <StatusBar byStatus={total.byStatus} total={total.totalRooms} meta={meta} />
            </div>

            {perOffice.length > 1 && (
              <ul className="space-y-3">
                {perOffice.map(({ office, count, byStatus }) => (
                  <li key={office.id}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate text-sm text-slate-700">{office.nama}</p>
                      <Counts byStatus={byStatus} meta={meta} />
                    </div>
                    <StatusBar byStatus={byStatus} total={count} meta={meta} />
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">
                {changes.length === 0
                  ? 'Tidak ada ruangan yang berubah status'
                  : `${changes.length} ruangan berubah status`}
              </p>
              {changes.length > 0 && (
                <ul className="space-y-1.5">
                  {changes.slice(0, MAX_CHANGES).map(({ room, from, to }) => (
                    <li key={room.id} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-slate-700">
                        {room.nama_ruangan}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-500">
                        {formatPercent(getOccupancyPercent(room))}
                      </span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${currentMeta[from].badge}`}
                      >
                        {currentMeta[from].label}
                      </span>
                      <ArrowRight className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${meta[to].badge}`}
                      >
                        {meta[to].label}
                      </span>
                    </li>
                  ))}
                  {changes.length > MAX_CHANGES && (
                    <li className="text-xs text-slate-500">
                      dan {changes.length - MAX_CHANGES} ruangan lainnya
                    </li>
                  )}
                </ul>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
