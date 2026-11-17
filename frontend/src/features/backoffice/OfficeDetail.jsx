import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, FileDown, Pencil, Phone, Trash2, X } from 'lucide-react';
import FloorPlanCanvas from '../../components/floorplan/FloorPlanCanvas';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { OccupancyBar, StatusBadge } from '../../components/ui/StatusBadge';
import { useConfirm, useToast } from '../../components/ui/feedbackContext';
import { StatusRulesContext } from '../../components/ui/statusRulesContext';
import { FURNITURE } from '../../domain/elements';
import { ROOM_TYPES, planBounds, routeSegmentsByFloor } from '../../domain/geometry';
import { formatDateTime } from '../../domain/guestVisit';
import { STATUS_ORDER, formatPercent, hasOwnRules, statusMeta } from '../../domain/occupancy';
import { planRoute } from '../../domain/pathfinding';
import { deleteOffice, updateOffice } from '../../services/officeService';
import OfficeForm from '../offices/OfficeForm';
import GuestLog from './GuestLog';
import OfficeRulesCard from './OfficeRulesCard';
import { formatNumber, officeScope, publicOfficeUrl, whatsappNumber } from './officeScope';
import { printAsPdf } from './printPdf';

function DetailRow({ label, children }) {
  return (
    <tr className="align-top">
      <th className="w-36 py-2 pr-3 text-left text-sm font-normal text-slate-500">{label}</th>
      <td className="py-2 text-sm text-slate-900">{children}</td>
    </tr>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
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

function FloorPlan({ scope, floorId, selectedId, visit, route, segments, onRoomClick }) {
  const floorRooms = scope.rooms.filter((r) => r.lantai_id === floorId);
  const box = planBounds(floorRooms, 1.5);
  return (
    <div
      className="mx-auto max-h-[520px] w-full overflow-hidden rounded-lg bg-white ring-1 ring-inset ring-slate-200"
      style={{ aspectRatio: `${box.w} / ${box.h}`, maxWidth: `${(520 * box.w) / box.h}px` }}
    >
      <FloorPlanCanvas
        rooms={floorRooms}
        doors={scope.doors}
        elements={scope.elements}
        roomsById={scope.roomsById}
        box={box}
        selectedId={selectedId}
        startId={visit && route ? visit.asal_id : null}
        targetId={visit && route ? visit.tujuan_id : null}
        routeSegments={segments.get(floorId) ?? []}
        onRoomPointerDown={onRoomClick}
      />
    </div>
  );
}

/** Detail satu kantor: data & PIC, denah, ringkasan, aturan status, ruangan, dan riwayat tamu. */
export default function OfficeDetail({ office, offices, data, onBack }) {
  const toast = useToast();
  const confirm = useConfirm();
  const planRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [floorChoice, setFloorChoice] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [visit, setVisit] = useState(null);

  const scope = useMemo(() => officeScope(office, offices, data), [office, offices, data]);
  const { floors, rooms, roomsById, doors, summary, rules } = scope;
  const meta = statusMeta(rules);
  const floorName = (id) => floors.find((f) => f.id === id)?.nama ?? '?';
  const floorOrder = new Map(floors.map((f, i) => [f.id, i]));

  const route = useMemo(
    () => (visit ? visitRoute(visit, rooms, roomsById, doors) : null),
    [visit, rooms, roomsById, doors],
  );
  const segments = useMemo(
    () => (route ? routeSegmentsByFloor(route.roomIds, roomsById, doors) : new Map()),
    [route, roomsById, doors],
  );
  const floorId = floors.some((f) => f.id === floorChoice) ? floorChoice : (floors[0]?.id ?? null);

  const showOnPlan = (room) => {
    setVisit(null);
    setSelectedRoomId(room.id);
    setFloorChoice(room.lantai_id);
    planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const handleRoomClick = (_event, room) => {
    setVisit(null);
    setSelectedRoomId((id) => (id === room.id ? null : room.id));
  };

  const selectVisit = (next) => {
    const same = visit?.id === next.id;
    setVisit(same ? null : next);
    setSelectedRoomId(null);
    if (!same && roomsById.has(next.asal_id)) setFloorChoice(roomsById.get(next.asal_id).lantai_id);
    planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Hapus ${office.nama}?`,
      message: 'Kantor hanya bisa dihapus bila sudah tidak punya lantai.',
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteOffice(office, data.floors);
      toast.success(`${office.nama} dihapus.`);
      onBack();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const sortedRooms = [...rooms].sort(
    (a, b) =>
      floorOrder.get(a.lantai_id) - floorOrder.get(b.lantai_id) ||
      a.nama_ruangan.localeCompare(b.nama_ruangan, 'id'),
  );
  const doorCount = (room) =>
    doors.filter((d) => d.room_from === room.id || d.room_to === room.id).length;
  const furnitureOf = (room) => {
    const items = scope.elements.filter((e) => e.jenis === 'furnitur' && e.room_id === room.id);
    return {
      count: items.length,
      seats: items.reduce((sum, e) => sum + (FURNITURE[e.model]?.seats ?? 0), 0),
    };
  };
  const selectedRoom = roomsById.get(selectedRoomId);

  let planDescription = 'Klik ruangan di denah atau di tabel untuk menandainya.';
  if (visit) {
    planDescription = `Jalur ${visit.nama}: ${visit.asal_nama} → ${visit.tujuan_nama}${
      route?.recomputed ? ' (dihitung ulang dari kondisi sekarang)' : ''
    }${route ? '' : ' (ruangannya sudah tidak ada)'}`;
  } else if (selectedRoom) {
    planDescription = `${selectedRoom.nama_ruangan} ditandai garis biru putus-putus.`;
  }

  return (
    <StatusRulesContext.Provider value={rules}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={onBack}>
            Semua kantor
          </Button>
          <div className="flex flex-wrap gap-2">
            <a
              href={publicOfficeUrl(office)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-2.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Lihat halaman publik
            </a>
            <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditing(true)}>
              Ubah data & PIC
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Trash2}
              onClick={remove}
              className="hover:bg-red-50 hover:text-red-600"
            >
              Hapus
            </Button>
            <Button size="sm" icon={FileDown} onClick={() => printAsPdf(`Kantor ${office.nama}`)}>
              Export PDF
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">{office.nama}</h3>
            <p className="text-sm text-slate-500">
              {[office.alamat, office.pic_nama && `PIC ${office.pic_nama} · ${office.pic_telp}`]
                .filter(Boolean)
                .join(' · ') || 'Alamat dan PIC belum diisi'}
            </p>
          </div>
          <p className="hidden text-xs text-slate-500 print:block">
            Dicetak {formatDateTime(new Date())}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Lantai" value={floors.length} />
          <Stat label="Ruangan" value={summary.totalRooms} />
          <Stat label="Total luas" value={`${formatNumber(scope.totalArea)} m²`} />
          <Stat
            label="Orang di kantor"
            value={`${summary.totalOccupancy}/${summary.totalCapacity}`}
            hint={`rata-rata isi ${formatPercent(summary.averagePercent)}`}
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-6 print:grid-cols-1 lg:grid-cols-5">
          <div ref={planRef} className="scroll-mt-4 lg:col-span-3">
            <Card className="print:hidden">
              <CardHeader
                title={floorId ? `Denah ${floorName(floorId)}` : 'Denah'}
                description={planDescription}
                action={
                  (visit || selectedRoom) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={X}
                      onClick={() => {
                        setVisit(null);
                        setSelectedRoomId(null);
                      }}
                    >
                      Tutup
                    </Button>
                  )
                }
              />
              <CardBody>
                {floors.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">
                    Kantor ini belum punya lantai. Denah dibuat di menu Manajemen.
                  </p>
                ) : (
                  <>
                    {floors.length > 1 && (
                      <div className="mb-3 flex flex-wrap gap-1">
                        {floors.map((f) => (
                          <Button
                            key={f.id}
                            size="sm"
                            variant={f.id === floorId ? 'primary' : 'secondary'}
                            onClick={() => setFloorChoice(f.id)}
                          >
                            {f.nama}
                            {segments.has(f.id) && ' •'}
                          </Button>
                        ))}
                      </div>
                    )}
                    <FloorPlan
                      scope={scope}
                      floorId={floorId}
                      selectedId={visit ? null : selectedRoomId}
                      visit={visit}
                      route={route}
                      segments={segments}
                      onRoomClick={handleRoomClick}
                    />
                  </>
                )}
              </CardBody>
            </Card>

            {/* PDF: semua lantai dicetak berurutan */}
            <div className="hidden space-y-4 print:block">
              {floors.map((f) => (
                <Card key={f.id} className="print:break-inside-avoid">
                  <CardHeader title={`Denah ${f.nama}`} />
                  <CardBody>
                    <FloorPlan
                      scope={scope}
                      floorId={f.id}
                      selectedId={null}
                      visit={null}
                      route={null}
                      segments={new Map()}
                    />
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-6 lg:col-span-2">
            <Card className="print:break-inside-avoid">
              <CardHeader title="Detail kantor" />
              <CardBody className="pt-2">
                <table className="w-full">
                  <tbody className="divide-y divide-slate-100">
                    <DetailRow label="Nama">{office.nama}</DetailRow>
                    <DetailRow label="Alamat">{office.alamat || '—'}</DetailRow>
                    <DetailRow label="PIC">
                      {office.pic_nama ? (
                        <>
                          <p>{office.pic_nama}</p>
                          <p className="flex flex-wrap items-center gap-x-3 text-xs">
                            <a
                              href={`tel:${office.pic_telp}`}
                              className="inline-flex items-center gap-1 tabular-nums text-blue-600 hover:underline"
                            >
                              <Phone className="size-3" aria-hidden />
                              {office.pic_telp}
                            </a>
                            <a
                              href={`https://wa.me/${whatsappNumber(office.pic_telp)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-700 hover:underline print:hidden"
                            >
                              WhatsApp
                            </a>
                          </p>
                        </>
                      ) : (
                        <span className="text-amber-700">Belum diisi</span>
                      )}
                    </DetailRow>
                    <DetailRow label="Lantai">
                      {floors.length === 0 ? (
                        '—'
                      ) : (
                        <ul className="space-y-0.5">
                          {floors.map((f) => {
                            const floorRooms = rooms.filter((r) => r.lantai_id === f.id);
                            return (
                              <li key={f.id}>
                                {f.nama}{' '}
                                <span className="text-xs text-slate-500">
                                  · {floorRooms.length} ruangan ·{' '}
                                  {formatNumber(floorRooms.reduce((s, r) => s + r.luas, 0))} m²
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </DetailRow>
                    <DetailRow label="Total luas">
                      <span className="font-semibold">{formatNumber(scope.totalArea)} m²</span>
                    </DetailRow>
                    <DetailRow label="Kapasitas">{summary.totalCapacity} orang</DetailRow>
                    <DetailRow label="Isi sekarang">
                      <span className="tabular-nums">
                        {summary.totalOccupancy}/{summary.totalCapacity} orang · rata-rata{' '}
                        {formatPercent(summary.averagePercent)}
                      </span>
                    </DetailRow>
                    <DetailRow label="Status ruangan">
                      <span className="flex flex-wrap gap-x-3">
                        {STATUS_ORDER.map((key) => (
                          <span key={key} className={meta[key].text}>
                            {summary.byStatus[key]} {meta[key].label.toLowerCase()}
                          </span>
                        ))}
                      </span>
                    </DetailRow>
                    <DetailRow label="Aturan status">
                      Kuning {rules.kuning}% · Merah {rules.merah}%{' '}
                      <span className="text-slate-500">
                        ({hasOwnRules(office) ? 'aturan sendiri' : 'bawaan'})
                      </span>
                    </DetailRow>
                  </tbody>
                </table>
              </CardBody>
            </Card>

            <OfficeRulesCard
              key={`${office.id}-${office.batas_kuning}-${office.batas_merah}`}
              office={office}
              rooms={rooms}
            />
          </div>
        </div>

        <Card>
          <CardHeader
            title="Detail ruangan"
            description={
              <>
                {rooms.length} ruangan
                <span className="print:hidden">. Klik ruangan untuk menandainya di denah.</span>
              </>
            }
          />
          <CardBody>
            {rooms.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Belum ada ruangan.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto print:mx-0 print:overflow-visible">
                <table className="w-full min-w-[860px] text-left text-sm print:min-w-0">
                  <thead className="border-y border-slate-100 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5">Ruangan</th>
                      <th className="px-3 py-2.5">Lantai</th>
                      <th className="px-3 py-2.5 text-right">Ukuran</th>
                      <th className="px-3 py-2.5 text-right">Luas</th>
                      <th className="px-3 py-2.5 text-right">Kapasitas</th>
                      <th className="px-3 py-2.5">Isi</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Pintu</th>
                      <th className="px-5 py-2.5 text-right">Furnitur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedRooms.map((room) => {
                      const furniture = furnitureOf(room);
                      return (
                        <tr
                          key={room.id}
                          onClick={() => showOnPlan(room)}
                          className={`cursor-pointer print:break-inside-avoid ${
                            room.id === selectedRoomId && !visit
                              ? 'bg-blue-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-5 py-2.5">
                            <p className="font-medium text-slate-900">{room.nama_ruangan}</p>
                            <p className="text-xs text-slate-500">{ROOM_TYPES[room.tipe]?.label}</p>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {floorName(room.lantai_id)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-600">
                            {formatNumber(room.w)} × {formatNumber(room.h)} m
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-900">
                            {formatNumber(room.luas)} m²
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                            {room.kapasitas_max}
                          </td>
                          <td className="w-32 px-3 py-2.5">
                            <p className="mb-1 text-xs tabular-nums text-slate-600">
                              {room.occupancy}/{room.kapasitas_max}
                            </p>
                            <OccupancyBar room={room} />
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge room={room} />
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                            {doorCount(room)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-2.5 text-right text-xs tabular-nums text-slate-600">
                            {furniture.count === 0
                              ? '—'
                              : `${furniture.count} item${furniture.seats ? ` · ${furniture.seats} kursi` : ''}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <GuestLog
          office={office}
          offices={[office]}
          selectedVisitId={visit?.id ?? null}
          onSelectVisit={selectVisit}
        />
      </div>

      <Modal open={editing} title={`Ubah ${office.nama}`} onClose={() => setEditing(false)}>
        {editing && (
          <OfficeForm
            initialValues={{
              nama: office.nama,
              alamat: office.alamat,
              pic_nama: office.pic_nama,
              pic_telp: office.pic_telp,
            }}
            submitLabel="Simpan"
            onCancel={() => setEditing(false)}
            onSubmit={async (values) => {
              await updateOffice(office.id, values);
              toast.success('Data kantor disimpan.');
              setEditing(false);
            }}
          />
        )}
      </Modal>
    </StatusRulesContext.Provider>
  );
}
