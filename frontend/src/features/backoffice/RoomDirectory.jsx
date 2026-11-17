import { useMemo, useState } from 'react';
import { ChevronRight, DoorOpen, FileDown, Search } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { Field, Input, Select } from '../../components/ui/Field';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ROOM_TYPES } from '../../domain/geometry';
import { hasOwnRules } from '../../domain/occupancy';
import { printAsPdf } from './printPdf';
import RoomDetail from './RoomDetail';

const formatNumber = (value) => value.toLocaleString('id-ID', { maximumFractionDigits: 2 });

/** Daftar ruangan per kantor; klik ruangan untuk detail, denah, dan riwayat tamunya. */
export default function RoomDirectory({ offices, floors, rooms, doors, elements, activeOfficeId }) {
  const [officeId, setOfficeId] = useState(
    () => (offices.some((o) => o.id === activeOfficeId) ? activeOfficeId : offices[0]?.id) ?? null,
  );
  const [floorFilter, setFloorFilter] = useState('semua');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const office = offices.find((o) => o.id === officeId) ?? null;
  // Lantai lama tanpa office_id dianggap milik kantor pertama (sama dengan useActiveOffice)
  const officeFloors = useMemo(
    () => floors.filter((f) => (f.office_id ?? offices[0]?.id) === officeId),
    [floors, offices, officeId],
  );
  const floorIds = useMemo(() => new Set(officeFloors.map((f) => f.id)), [officeFloors]);
  const officeRooms = useMemo(
    () => rooms.filter((r) => floorIds.has(r.lantai_id)),
    [rooms, floorIds],
  );
  const roomsById = useMemo(() => new Map(officeRooms.map((r) => [r.id, r])), [officeRooms]);
  const officeDoors = useMemo(
    () => doors.filter((d) => roomsById.has(d.room_from) && roomsById.has(d.room_to)),
    [doors, roomsById],
  );
  const floorName = (id) => officeFloors.find((f) => f.id === id)?.nama ?? '?';
  const floorOrder = new Map(officeFloors.map((f, i) => [f.id, i]));

  const shown = officeRooms
    .filter(
      (r) =>
        (floorFilter === 'semua' || r.lantai_id === Number(floorFilter)) &&
        r.nama_ruangan.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .sort(
      (a, b) =>
        floorOrder.get(a.lantai_id) - floorOrder.get(b.lantai_id) ||
        a.nama_ruangan.localeCompare(b.nama_ruangan, 'id'),
    );

  const selected = roomsById.get(selectedId);
  if (selected) {
    return (
      <RoomDetail
        room={selected}
        office={office}
        floors={officeFloors}
        rooms={officeRooms}
        roomsById={roomsById}
        doors={officeDoors}
        elements={elements.filter((e) => floorIds.has(e.lantai_id))}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  const totalArea = shown.reduce((sum, r) => sum + r.luas, 0);
  const totalCapacity = shown.reduce((sum, r) => sum + r.kapasitas_max, 0);
  const totalOccupancy = shown.reduce((sum, r) => sum + r.occupancy, 0);

  return (
    <Card>
      <CardHeader
        title={`Ruangan${office ? ` · ${office.nama}` : ''}`}
        description={`${shown.length} ruangan · ${formatNumber(totalArea)} m² · ${totalOccupancy}/${totalCapacity} orang. Klik ruangan untuk melihat detailnya.`}
        action={
          <span className="print:hidden">
            <Button
              variant="secondary"
              size="sm"
              icon={FileDown}
              disabled={shown.length === 0}
              onClick={() => printAsPdf(`Daftar ruangan - ${office?.nama ?? 'kantor'}`)}
            >
              Export PDF
            </Button>
          </span>
        }
      />
      <CardBody>
        <div className="mb-4 grid grid-cols-1 gap-3 print:hidden sm:grid-cols-3">
          <Field label="Kantor">
            {(id) => (
              <Select
                id={id}
                value={officeId ?? ''}
                onChange={(e) => {
                  setOfficeId(Number(e.target.value));
                  setFloorFilter('semua');
                }}
              >
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nama}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Lantai">
            {(id) => (
              <Select id={id} value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)}>
                <option value="semua">Semua lantai</option>
                {officeFloors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nama}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Cari">
            {(id) => (
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  id={id}
                  type="search"
                  value={search}
                  placeholder="Nama ruangan…"
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
          </Field>
        </div>

        {shown.length === 0 ? (
          <EmptyState
            icon={DoorOpen}
            title="Tidak ada ruangan"
            description="Ruangan digambar di menu Manajemen (editor denah)."
          />
        ) : (
          <div className="-mx-5 overflow-x-auto print:mx-0 print:overflow-visible">
            <table className="w-full min-w-[720px] text-left text-sm print:min-w-0">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5">Ruangan</th>
                  <th className="px-3 py-2.5">Lantai</th>
                  <th className="px-3 py-2.5 text-right">Ukuran</th>
                  <th className="px-3 py-2.5 text-right">Luas</th>
                  <th className="px-3 py-2.5 text-right">Isi</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="w-8 px-3 py-2.5 print:hidden">
                    <span className="sr-only">Buka</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((room) => (
                  <tr
                    key={room.id}
                    onClick={() => setSelectedId(room.id)}
                    className="cursor-pointer hover:bg-slate-50 print:break-inside-avoid"
                  >
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(room.id);
                        }}
                        className="text-left font-medium text-slate-900 hover:text-blue-600"
                      >
                        {room.nama_ruangan}
                      </button>
                      <p className="text-xs text-slate-500">{ROOM_TYPES[room.tipe]?.label}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{floorName(room.lantai_id)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-600">
                      {formatNumber(room.w)} × {formatNumber(room.h)} m
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-900">
                      {formatNumber(room.luas)} m²
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-600">
                      {room.occupancy}/{room.kapasitas_max}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge room={room} />
                      {hasOwnRules(room) && (
                        <p className="mt-1 text-xs text-slate-500">
                          Aturan sendiri {room.batas_kuning}/{room.batas_merah}%
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-400 print:hidden">
                      <ChevronRight className="size-4" aria-hidden />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
