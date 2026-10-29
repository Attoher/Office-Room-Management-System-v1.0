import { useMemo, useRef, useState } from 'react';
import { MousePointer2, Share2, SquarePlus, ZoomIn, ZoomOut } from 'lucide-react';
import ConnectionDiagram from '../../components/floorplan/ConnectionDiagram';
import FloorPlanCanvas from '../../components/floorplan/FloorPlanCanvas';
import { toPlanPoint } from '../../components/floorplan/planPoint';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/feedbackContext';
import {
  MIN_ROOM_SIDE,
  doorGeometry,
  geometryError,
  offsetFromPoint,
  planBounds,
  snapToGrid,
} from '../../domain/geometry';
import { updateDoor } from '../../services/doorService';
import { createRoom, updateRoomGeometry } from '../../services/roomService';
import RoomInfoForm from './RoomInfoForm';

const DRAG_THRESHOLD = 0.15; // meter
const ZOOM_STEPS = [1, 1.5, 2, 3];
// Area kerja minimal supaya selalu ada ruang kosong untuk menggambar
const WORK_AREA = { x: -1, y: -1, w: 32, h: 22 };
const HANDLE = 0.35;

function unionBox(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

/** Kotak dari dua titik sudut, dibulatkan ke grid. */
function rectFromPoints(a, b) {
  const x1 = snapToGrid(Math.min(a.x, b.x));
  const y1 = snapToGrid(Math.min(a.y, b.y));
  const x2 = snapToGrid(Math.max(a.x, b.x));
  const y2 = snapToGrid(Math.max(a.y, b.y));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export default function FloorEditor({
  floorId,
  floors,
  rooms,
  roomsById,
  doors,
  selectedId,
  onSelect,
}) {
  const toast = useToast();
  const svgRef = useRef(null);
  const [mode, setMode] = useState('select');
  const [drag, setDrag] = useState(null);
  const [draft, setDraft] = useState(null); // kotak ruangan baru yang menunggu diisi
  const [zoomIndex, setZoomIndex] = useState(0);

  const floorRooms = useMemo(() => rooms.filter((r) => r.lantai_id === floorId), [rooms, floorId]);

  // Selama drag, posisi/ukuran ruangan & pintu yang digeser ditimpa sementara
  const previewRooms = useMemo(() => {
    if (!drag?.rect || drag.kind === 'draw') return floorRooms;
    return floorRooms.map((r) => (r.id === drag.roomId ? { ...r, ...drag.rect } : r));
  }, [floorRooms, drag]);
  const previewById = useMemo(() => {
    const map = new Map(roomsById);
    previewRooms.forEach((r) => map.set(r.id, r));
    return map;
  }, [roomsById, previewRooms]);
  const previewDoors = useMemo(
    () =>
      drag?.kind === 'door'
        ? doors.map((d) => (d.id === drag.doorId ? { ...d, offset: drag.offset } : d))
        : doors,
    [doors, drag],
  );

  const box = drag?.box ?? unionBox(planBounds(floorRooms, 2), WORK_AREA);
  // Ruangan terpilih hanya diberi pegangan bila ada di lantai yang sedang dibuka
  const selectedRoom = previewById.get(selectedId);
  const selected = selectedRoom?.lantai_id === floorId ? selectedRoom : null;
  const selectedDoors = selected
    ? previewDoors
        .filter((d) => d.room_from === selected.id || d.room_to === selected.id)
        .map((d) => {
          const a = previewById.get(d.room_from);
          const b = previewById.get(d.room_to);
          const geometry = a && b && doorGeometry(a, b, d.offset);
          return geometry && { door: d, geometry };
        })
        .filter(Boolean)
    : [];

  const point = (event) => toPlanPoint(svgRef.current, event);

  const begin = (event, state) => {
    event.stopPropagation();
    svgRef.current.setPointerCapture(event.pointerId);
    setDrag({ ...state, start: point(event), moved: false, box });
  };

  const handleBackgroundDown = (event) => {
    if (mode === 'draw') {
      begin(event, { kind: 'draw', rect: null });
    } else {
      onSelect(null);
    }
  };

  const handleRoomDown = (event, room) => {
    if (mode === 'draw') return; // biarkan menggambar mulai dari area kosong saja
    onSelect(room.id);
    begin(event, { kind: 'move', roomId: room.id, origin: room, rect: null });
  };

  const handleResizeDown = (event, corner) => {
    begin(event, { kind: 'resize', roomId: selected.id, origin: selected, corner, rect: null });
  };

  const handleDoorDown = (event, door, geometry) => {
    begin(event, { kind: 'door', doorId: door.id, wall: geometry.wall, offset: door.offset });
  };

  const handleMove = (event) => {
    if (!drag) return;
    const p = point(event);
    const moved = drag.moved || Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > DRAG_THRESHOLD;
    if (!moved) return;

    if (drag.kind === 'draw') {
      setDrag({ ...drag, moved, rect: rectFromPoints(drag.start, p) });
    } else if (drag.kind === 'move') {
      const { origin } = drag;
      setDrag({
        ...drag,
        moved,
        rect: {
          x: snapToGrid(origin.x + p.x - drag.start.x),
          y: snapToGrid(origin.y + p.y - drag.start.y),
          w: origin.w,
          h: origin.h,
        },
      });
    } else if (drag.kind === 'resize') {
      const { origin, corner } = drag;
      // Sudut yang berseberangan dengan pegangan tetap di tempat
      const fixed = {
        x: corner.includes('w') ? origin.x + origin.w : origin.x,
        y: corner.includes('n') ? origin.y + origin.h : origin.y,
      };
      const rect = rectFromPoints(fixed, p);
      setDrag({
        ...drag,
        moved,
        rect: { ...rect, w: Math.max(MIN_ROOM_SIDE, rect.w), h: Math.max(MIN_ROOM_SIDE, rect.h) },
      });
    } else if (drag.kind === 'door') {
      setDrag({ ...drag, moved, offset: offsetFromPoint(drag.wall, p) });
    }
  };

  const handleUp = async () => {
    if (!drag) return;
    const current = drag;
    if (!current.moved) {
      setDrag(null);
      return;
    }

    if (current.kind === 'draw') {
      setDrag(null);
      const { rect } = current;
      if (!rect || rect.w < MIN_ROOM_SIDE || rect.h < MIN_ROOM_SIDE) return;
      const error = geometryError({ ...rect, lantai_id: floorId }, rooms);
      if (error) {
        toast.error(error);
        return;
      }
      setDraft(rect);
      return;
    }

    // Pertahankan pratinjau sampai Firestore menerima perubahan, supaya tidak berkedip
    setDrag({ ...current, committing: true });
    try {
      if (current.kind === 'door') {
        const door = doors.find((d) => d.id === current.doorId);
        await updateDoor(door, { offset: current.offset }, doors, roomsById);
      } else {
        const room = roomsById.get(current.roomId);
        await updateRoomGeometry(room, current.rect, rooms);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDrag(null);
    }
  };

  const handleCreate = async (values) => {
    const id = await createRoom(values, { ...draft, lantai_id: floorId }, rooms);
    toast.success(`"${values.nama_ruangan.trim()}" ditambahkan.`);
    setDraft(null);
    setMode('select');
    onSelect(id);
  };

  const zoom = ZOOM_STEPS[zoomIndex];
  const corners = selected
    ? [
        ['nw', selected.x, selected.y],
        ['ne', selected.x + selected.w, selected.y],
        ['sw', selected.x, selected.y + selected.h],
        ['se', selected.x + selected.w, selected.y + selected.h],
      ]
    : [];
  const draftRect = drag?.kind === 'draw' ? drag.rect : draft;
  const sizeLabel = drag?.rect;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg bg-slate-100 p-1">
          {[
            ['select', 'Pilih & geser', MousePointer2],
            ['draw', 'Gambar ruangan', SquarePlus],
            ['diagram', 'Diagram', Share2],
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              aria-pressed={mode === key}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
                mode === key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {sizeLabel && (
            <span className="mr-2 rounded bg-slate-900 px-2 py-0.5 text-xs font-medium tabular-nums text-white">
              {sizeLabel.w} × {sizeLabel.h} m · ({sizeLabel.x}, {sizeLabel.y})
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            icon={ZoomOut}
            disabled={zoomIndex === 0}
            onClick={() => setZoomIndex((i) => i - 1)}
            aria-label="Perkecil"
          />
          <Button
            variant="ghost"
            size="icon"
            icon={ZoomIn}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            onClick={() => setZoomIndex((i) => i + 1)}
            aria-label="Perbesar"
          />
        </div>
      </div>

      <div
        className={`h-[480px] overflow-auto rounded-lg bg-white ring-1 ring-inset ring-slate-200 sm:h-[560px] ${
          mode === 'draw' ? 'cursor-crosshair' : ''
        }`}
      >
        {mode === 'diagram' ? (
          <ConnectionDiagram
            rooms={floorRooms}
            doors={doors}
            roomsById={roomsById}
            floorNames={new Map(floors.map((f) => [f.id, f.nama]))}
            // Diagram tidak perlu area kosong untuk menggambar, jadi dipaskan ke ruangan
            box={planBounds(floorRooms, 1.5)}
            zoom={zoom}
            selectedId={selectedId}
            onRoomClick={onSelect}
          />
        ) : (
          <FloorPlanCanvas
            ref={svgRef}
            rooms={previewRooms}
            doors={previewDoors}
            roomsById={previewById}
            box={box}
            zoom={zoom}
            selectedId={selectedId}
            onRoomPointerDown={handleRoomDown}
            onPointerDown={handleBackgroundDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={() => setDrag(null)}
          >
            {draftRect && (
              <rect
                x={draftRect.x}
                y={draftRect.y}
                width={draftRect.w}
                height={draftRect.h}
                fill="rgba(37, 99, 235, 0.08)"
                stroke="#2563eb"
                strokeWidth="0.08"
                strokeDasharray="0.3 0.2"
                pointerEvents="none"
              />
            )}

            {mode === 'select' &&
              selectedDoors.map(({ door, geometry }) => (
                <circle
                  key={door.id}
                  cx={geometry.point.x}
                  cy={geometry.point.y}
                  r="0.22"
                  fill="#ffffff"
                  stroke="#2563eb"
                  strokeWidth="0.07"
                  style={{ cursor: geometry.wall.orientation === 'v' ? 'ns-resize' : 'ew-resize' }}
                  onPointerDown={(event) => handleDoorDown(event, door, geometry)}
                >
                  <title>Geser untuk memindahkan pintu</title>
                </circle>
              ))}

            {mode === 'select' &&
              corners.map(([corner, x, y]) => (
                <rect
                  key={corner}
                  x={x - HANDLE / 2}
                  y={y - HANDLE / 2}
                  width={HANDLE}
                  height={HANDLE}
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth="0.05"
                  style={{
                    cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                  }}
                  onPointerDown={(event) => handleResizeDown(event, corner)}
                />
              ))}
          </FloorPlanCanvas>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {mode === 'draw'
          ? 'Tarik di area kosong untuk menggambar ruangan baru (grid 0,5 m).'
          : mode === 'diagram'
            ? 'Garis = ruangan yang tersambung pintu. Titik tanpa garis belum punya pintu. Huruf di titik: K lorong, T tangga, L lift, A area luar. Klik titik untuk membuka detail ruangan.'
            : 'Klik ruangan untuk melihat detail. Geser untuk memindahkan, tarik sudut untuk mengubah ukuran, geser titik biru untuk memindahkan pintu.'}
      </p>

      <Modal open={Boolean(draft)} title="Ruangan baru" onClose={() => setDraft(null)}>
        {draft && (
          <>
            <p className="mb-4 text-sm text-slate-500">
              Ukuran {draft.w} × {draft.h} m (luas {draft.w * draft.h} m²).
            </p>
            <RoomInfoForm
              submitLabel="Tambah ruangan"
              onSubmit={handleCreate}
              onCancel={() => setDraft(null)}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
