import { useState } from 'react';
import { Maximize2, Minus, Plus, RotateCcw, Users } from 'lucide-react';
import Button from '../../components/ui/Button';
import { OccupancyBar, StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/feedbackContext';
import { ROOM_TYPES } from '../../domain/geometry';
import { changeOccupancy, setOccupancy } from '../../services/roomService';

export default function RoomCard({ room, floorName }) {
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const run = async (action) => {
    setPending(true);
    try {
      await action();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPending(false);
    }
  };

  const isEmpty = room.occupancy === 0;
  const isFull = room.occupancy >= room.kapasitas_max;

  return (
    <article className="flex flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900" title={room.nama_ruangan}>
            {room.nama_ruangan}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {[floorName, ROOM_TYPES[room.tipe]?.label, `${room.luas} m²`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <StatusBadge room={room} />
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <Users className="size-4 self-center text-slate-400" aria-hidden />
        <span className="text-2xl font-semibold tabular-nums text-slate-900">{room.occupancy}</span>
        <span className="text-sm text-slate-500">/ {room.kapasitas_max} orang</span>
      </div>
      <div className="mt-2">
        <OccupancyBar room={room} />
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
        <Button
          variant="secondary"
          size="icon"
          icon={Minus}
          disabled={pending || isEmpty}
          onClick={() => run(() => changeOccupancy(room, -1))}
          aria-label={`Kurangi 1 orang di ${room.nama_ruangan}`}
        />
        <Button
          variant="secondary"
          size="icon"
          icon={Plus}
          disabled={pending || isFull}
          onClick={() => run(() => changeOccupancy(room, 1))}
          aria-label={`Tambah 1 orang di ${room.nama_ruangan}`}
        />
        <div className="ml-auto flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            disabled={pending || isEmpty}
            onClick={() => run(() => setOccupancy(room, 0))}
          >
            Kosongkan
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Maximize2}
            disabled={pending || isFull}
            onClick={() => run(() => setOccupancy(room, room.kapasitas_max))}
          >
            Penuhi
          </Button>
        </div>
      </div>
    </article>
  );
}
