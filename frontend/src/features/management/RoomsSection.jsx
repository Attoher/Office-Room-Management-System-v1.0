import { Building2 } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ROOM_TYPES } from '../../domain/geometry';

/** Daftar semua ruangan di semua lantai; klik baris untuk membukanya di editor. */
export default function RoomsSection({ rooms, floors, doors, selectedId, onSelect }) {
  const floorName = (id) => floors.find((f) => f.id === id)?.nama ?? '-';
  const doorCount = (roomId) =>
    doors.filter((d) => d.room_from === roomId || d.room_to === roomId).length;

  return (
    <Card>
      <CardHeader
        title="Daftar ruangan"
        description={`${rooms.length} ruangan · ${doors.length} pintu & penghubung`}
      />
      {rooms.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Belum ada ruangan"
          description="Pilih mode Gambar ruangan di editor lalu tarik kotak di denah."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Nama</th>
                <th className="px-3 py-2.5">Lantai</th>
                <th className="px-3 py-2.5">Tipe</th>
                <th className="px-3 py-2.5 text-right">Ukuran</th>
                <th className="px-3 py-2.5 text-right">Pintu</th>
                <th className="px-3 py-2.5 text-right">Isi</th>
                <th className="px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rooms.map((room) => (
                <tr
                  key={room.id}
                  onClick={() => onSelect(room)}
                  className={`cursor-pointer ${
                    room.id === selectedId ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="max-w-48 truncate px-5 py-3 font-medium text-slate-900">
                    {room.nama_ruangan}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                    {floorName(room.lantai_id)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                    {ROOM_TYPES[room.tipe]?.label}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-600">
                    {room.w} × {room.h} m · {room.luas} m²
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-600">
                    {doorCount(room.id)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-600">
                    {room.occupancy}/{room.kapasitas_max}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <StatusBadge room={room} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
