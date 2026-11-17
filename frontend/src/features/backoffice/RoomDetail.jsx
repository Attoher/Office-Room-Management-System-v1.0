import { useMemo, useState } from 'react';
import { ArrowLeft, FileDown, X } from 'lucide-react';
import FloorPlanCanvas from '../../components/floorplan/FloorPlanCanvas';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { OccupancyBar, StatusBadge } from '../../components/ui/StatusBadge';
import { useStatusRules } from '../../components/ui/statusRulesContext';
import { FURNITURE } from '../../domain/elements';
import { ROOM_TYPES, doorType, planBounds, routeSegmentsByFloor } from '../../domain/geometry';
import { formatDateTime } from '../../domain/guestVisit';
import {
  formatPercent,
  getOccupancyPercent,
  hasOwnRules,
  roomStatusRules,
  statusMeta,
} from '../../domain/occupancy';
import { planRoute } from '../../domain/pathfinding';
import GuestLog from './GuestLog';
import { printAsPdf } from './printPdf';
import RoomRulesCard from './RoomRulesCard';

const formatNumber = (value) => value.toLocaleString('id-ID', { maximumFractionDigits: 2 });

function DetailRow({ label, children }) {
  return (
    <tr className="align-top">
      <th className="w-40 py-2 pr-3 text-left text-sm font-normal text-slate-500">{label}</th>
      <td className="py-2 text-sm text-slate-900">{children}</td>
    </tr>
  );
}

/**
 * Jalur kunjungan: yang tersimpan saat dicatat, atau (catatan lama) dihitung ulang dari kondisi
 * sekarang. null bila ruangannya sudah tidak ada.
 */
function visitRoute(visit, rooms, roomsById, doors) {
  if (visit.jalur?.length > 1 && visit.jalur.every((id) => roomsById.has(id))) {
    return { roomIds: visit.jalur, recomputed: false };
  }
  if (!roomsById.has(visit.asal_id) || !roomsById.has(visit.tujuan_id)) return null;
  const best = planRoute(rooms, doors, visit.asal_id, visit.tujuan_id).bestRoute;
  return best ? { roomIds: best.roomIds, recomputed: true } : null;
}

/** Detail satu ruangan: denah, ukuran & luas, status, koneksi, isi, dan riwayat tamunya. */
export default function RoomDetail({
  room,
  office,
  floors,
  rooms,
  roomsById,
  doors,
  elements,
  onBack,
}) {
  const { rules, statusOf } = useStatusRules();
  const [visit, setVisit] = useState(null);
  const [floorChoice, setFloorChoice] = useState(room.lantai_id);

  const floorName = (id) => floors.find((f) => f.id === id)?.nama ?? '?';
  // Rentang persen menurut aturan yang berlaku untuk ruangan ini (sendiri atau umum)
  const status = statusMeta(roomStatusRules(room, rules))[statusOf(room)];

  const route = useMemo(
    () => (visit ? visitRoute(visit, rooms, roomsById, doors) : null),
    [visit, rooms, roomsById, doors],
  );
  const segments = useMemo(
    () => (route ? routeSegmentsByFloor(route.roomIds, roomsById, doors) : new Map()),
    [route, roomsById, doors],
  );
  const routeFloors = [...segments.keys()];
  // Lantai yang digambar: lantai ruangan ini, atau lantai lain yang dilewati jalur tamu
  const floorId =
    floorChoice === room.lantai_id || routeFloors.includes(floorChoice)
      ? floorChoice
      : room.lantai_id;
  const floorRooms = rooms.filter((r) => r.lantai_id === floorId);
  const box = planBounds(floorRooms, 1.5);

  // Pintu & penghubung tangga/lift yang menempel ke ruangan ini
  const connections = doors
    .filter((d) => d.room_from === room.id || d.room_to === room.id)
    .map((d) => {
      const other = roomsById.get(d.room_from === room.id ? d.room_to : d.room_from);
      const vertical = other.lantai_id !== room.lantai_id;
      return {
        id: d.id ?? `${d.room_from}-${d.room_to}-${d.offset}`,
        other,
        label: vertical ? `Penghubung ke ${floorName(other.lantai_id)}` : doorType(d).label,
      };
    });

  const roomElements = elements.filter((e) => e.room_id === room.id);
  const windows = roomElements.filter((e) => e.jenis === 'jendela');
  const furnitureCounts = new Map();
  for (const item of roomElements.filter((e) => e.jenis === 'furnitur')) {
    furnitureCounts.set(item.model, (furnitureCounts.get(item.model) ?? 0) + 1);
  }
  const seats = [...furnitureCounts].reduce(
    (sum, [model, count]) => sum + (FURNITURE[model]?.seats ?? 0) * count,
    0,
  );
  const areaPerPerson = room.kapasitas_max > 0 ? room.luas / room.kapasitas_max : null;

  const selectVisit = (next) => {
    setVisit((current) => (current?.id === next.id ? null : next));
    setFloorChoice(room.lantai_id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={onBack}>
          Semua ruangan
        </Button>
        <Button
          size="sm"
          icon={FileDown}
          onClick={() => printAsPdf(`Ruangan ${room.nama_ruangan} - ${office?.nama ?? ''}`)}
        >
          Export PDF
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{room.nama_ruangan}</h3>
          <p className="text-sm text-slate-500">
            {[office?.nama, floorName(room.lantai_id), ROOM_TYPES[room.tipe]?.label]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="text-right">
          <StatusBadge room={room} />
          <p className="mt-1 hidden text-xs text-slate-500 print:block">
            Dicetak {formatDateTime(new Date())}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 print:grid-cols-1 lg:grid-cols-5">
        <Card className="print:break-inside-avoid lg:col-span-3">
          <CardHeader
            title={`Denah ${floorName(floorId)}`}
            description={
              visit ? (
                `Jalur ${visit.nama}: ${visit.asal_nama} → ${visit.tujuan_nama}${route?.recomputed ? ' (dihitung ulang dari kondisi sekarang)' : ''}`
              ) : (
                <>
                  Ruangan ini ditandai garis biru putus-putus.
                  <span className="print:hidden">
                    {' '}
                    Klik tamu di riwayat untuk melihat jalurnya.
                  </span>
                </>
              )
            }
            action={
              visit && (
                <span className="print:hidden">
                  <Button variant="ghost" size="sm" icon={X} onClick={() => setVisit(null)}>
                    Tutup jalur
                  </Button>
                </span>
              )
            }
          />
          <CardBody>
            {routeFloors.length > 1 && (
              <div className="mb-3 flex flex-wrap gap-1 print:hidden">
                {routeFloors.map((id) => (
                  <Button
                    key={id}
                    size="sm"
                    variant={id === floorId ? 'primary' : 'secondary'}
                    onClick={() => setFloorChoice(id)}
                  >
                    {floorName(id)}
                  </Button>
                ))}
              </div>
            )}
            <div
              className="mx-auto max-h-[520px] w-full overflow-hidden rounded-lg bg-white ring-1 ring-inset ring-slate-200"
              style={{ aspectRatio: `${box.w} / ${box.h}`, maxWidth: `${(520 * box.w) / box.h}px` }}
            >
              <FloorPlanCanvas
                rooms={floorRooms}
                doors={doors}
                elements={elements}
                roomsById={roomsById}
                box={box}
                selectedId={visit ? null : room.id}
                startId={visit && route ? visit.asal_id : null}
                targetId={visit && route ? visit.tujuan_id : null}
                routeSegments={segments.get(floorId) ?? []}
              />
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card className="print:break-inside-avoid">
            <CardHeader title="Detail ruangan" />
            <CardBody className="pt-2">
              <table className="w-full">
                <tbody className="divide-y divide-slate-100">
                  <DetailRow label="Kantor">{office?.nama ?? '—'}</DetailRow>
                  <DetailRow label="Lantai">{floorName(room.lantai_id)}</DetailRow>
                  <DetailRow label="Tipe">{ROOM_TYPES[room.tipe]?.label ?? room.tipe}</DetailRow>
                  <DetailRow label="Ukuran">
                    {formatNumber(room.w)} × {formatNumber(room.h)} m
                  </DetailRow>
                  <DetailRow label="Luas">
                    <span className="font-semibold">{formatNumber(room.luas)} m²</span>
                  </DetailRow>
                  <DetailRow label="Kapasitas">{room.kapasitas_max} orang</DetailRow>
                  <DetailRow label="Luas per orang">
                    {areaPerPerson == null ? '—' : `${formatNumber(areaPerPerson)} m²`}
                  </DetailRow>
                  <DetailRow label="Isi sekarang">
                    <span className="tabular-nums">
                      {room.occupancy}/{room.kapasitas_max} orang ·{' '}
                      {formatPercent(getOccupancyPercent(room))}
                    </span>
                    <div className="mt-1.5">
                      <OccupancyBar room={room} />
                    </div>
                  </DetailRow>
                  <DetailRow label="Status">
                    <span className={`font-medium ${status.text}`}>
                      {status.label} ({status.range})
                    </span>{' '}
                    <span className="text-slate-500">
                      · {status.description} ·{' '}
                      {hasOwnRules(room) ? 'aturan sendiri' : 'aturan umum'}
                    </span>
                  </DetailRow>
                  <DetailRow label={`Pintu (${connections.length})`}>
                    {connections.length === 0 ? (
                      <span className="text-amber-700">Belum ada pintu</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {connections.map((c) => (
                          <li key={c.id}>
                            {c.other.nama_ruangan}{' '}
                            <span className="text-xs text-slate-500">· {c.label}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </DetailRow>
                  <DetailRow label="Jendela">{windows.length}</DetailRow>
                  <DetailRow label="Furnitur">
                    {furnitureCounts.size === 0 ? (
                      '—'
                    ) : (
                      <ul className="space-y-0.5">
                        {[...furnitureCounts].map(([model, count]) => (
                          <li key={model}>
                            {FURNITURE[model]?.label ?? model}{' '}
                            <span className="text-slate-500">× {count}</span>
                          </li>
                        ))}
                        {seats > 0 && (
                          <li className="text-xs text-slate-500">{seats} tempat duduk</li>
                        )}
                      </ul>
                    )}
                  </DetailRow>
                  <DetailRow label="PIC kantor">
                    {office?.pic_nama ? `${office.pic_nama} · ${office.pic_telp}` : '—'}
                  </DetailRow>
                </tbody>
              </table>
            </CardBody>
          </Card>
          <RoomRulesCard key={`${room.id}-${room.batas_kuning}-${room.batas_merah}`} room={room} />
        </div>
      </div>

      <GuestLog
        room={room}
        offices={office ? [office] : []}
        selectedVisitId={visit?.id ?? null}
        onSelectVisit={selectVisit}
      />
    </div>
  );
}
