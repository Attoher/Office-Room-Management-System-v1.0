import { rectCenter } from '../../domain/geometry';
import { STATUS_META, getOccupancyStatus } from '../../domain/occupancy';

// Satuan meter, sama dengan denah, supaya posisi titik = posisi ruangan
const FONT = 'Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif';
const NODE_RADIUS = 0.45;
const LABEL_SIZE = 0.32;

function truncate(text, width) {
  const max = Math.max(4, Math.floor(width / (LABEL_SIZE * 0.55)));
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Diagram koneksi satu lantai: titik di tengah setiap ruangan, garis hanya untuk pasangan
 * ruangan yang tersambung pintu. Penghubung tangga/lift ke lantai lain ditandai ↕.
 */
export default function ConnectionDiagram({
  rooms,
  doors,
  roomsById,
  floorNames,
  box,
  zoom = 1,
  selectedId,
  onRoomClick,
}) {
  const shownIds = new Set(rooms.map((room) => room.id));

  // Gabungkan beberapa pintu antara pasangan yang sama menjadi satu garis
  const edges = new Map();
  const verticalLinks = new Map();
  for (const door of doors) {
    const a = roomsById.get(door.room_from);
    const b = roomsById.get(door.room_to);
    if (!a || !b) continue;
    if (a.lantai_id !== b.lantai_id) {
      for (const [self, other] of [
        [a, b],
        [b, a],
      ]) {
        if (shownIds.has(self.id)) {
          verticalLinks.set(self.id, [
            ...(verticalLinks.get(self.id) ?? []),
            floorNames.get(other.lantai_id),
          ]);
        }
      }
      continue;
    }
    if (!shownIds.has(a.id) || !shownIds.has(b.id)) continue;
    const key = `${door.room_from}_${door.room_to}`;
    edges.set(key, { a, b, count: (edges.get(key)?.count ?? 0) + 1 });
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
      role="img"
      aria-label="Diagram koneksi ruangan"
    >
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#f8fafc" />

      {/* Garis bantu bentuk ruangan, sangat samar */}
      {rooms.map((room) => (
        <rect
          key={room.id}
          x={room.x}
          y={room.y}
          width={room.w}
          height={room.h}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="0.04"
        />
      ))}

      {[...edges.entries()].map(([key, { a, b, count }]) => {
        const ca = rectCenter(a);
        const cb = rectCenter(b);
        const active = selectedId === a.id || selectedId === b.id;
        return (
          <g key={key}>
            <line
              x1={ca.x}
              y1={ca.y}
              x2={cb.x}
              y2={cb.y}
              stroke={active ? '#2563eb' : '#94a3b8'}
              strokeWidth={active ? 0.12 : 0.07}
              strokeLinecap="round"
            />
            {count > 1 && (
              <text
                x={(ca.x + cb.x) / 2}
                y={(ca.y + cb.y) / 2 - 0.15}
                textAnchor="middle"
                fontFamily={FONT}
                fontSize="0.28"
                fontWeight="700"
                fill="#475569"
                paintOrder="stroke"
                stroke="#f8fafc"
                strokeWidth="0.12"
              >
                {count} pintu
              </text>
            )}
          </g>
        );
      })}

      {rooms.map((room) => {
        const c = rectCenter(room);
        const meta = STATUS_META[getOccupancyStatus(room)];
        const selected = room.id === selectedId;
        const vertical = verticalLinks.get(room.id);
        return (
          <g
            key={room.id}
            onPointerDown={() => onRoomClick?.(room.id)}
            style={{ cursor: onRoomClick ? 'pointer' : 'default' }}
          >
            <title>{`${room.nama_ruangan} · ${room.occupancy}/${room.kapasitas_max} orang`}</title>
            <circle
              cx={c.x}
              cy={c.y}
              r={NODE_RADIUS}
              fill={meta.hex}
              stroke={selected ? '#1d4ed8' : '#ffffff'}
              strokeWidth={selected ? 0.14 : 0.08}
            />
            {room.tipe !== 'ruangan' && (
              <text
                x={c.x}
                y={c.y + 0.1}
                textAnchor="middle"
                fontFamily={FONT}
                fontSize="0.3"
                fontWeight="800"
                fill="#ffffff"
                pointerEvents="none"
              >
                {room.tipe === 'tangga'
                  ? 'T'
                  : room.tipe === 'lift'
                    ? 'L'
                    : room.tipe === 'lorong'
                      ? 'K'
                      : 'A'}
              </text>
            )}
            <text
              x={c.x}
              y={c.y + NODE_RADIUS + 0.4}
              textAnchor="middle"
              fontFamily={FONT}
              fontSize={LABEL_SIZE}
              fontWeight={selected ? 800 : 600}
              fill="#0f172a"
              paintOrder="stroke"
              stroke="#f8fafc"
              strokeWidth="0.1"
              pointerEvents="none"
            >
              {truncate(room.nama_ruangan, Math.max(room.w, 2.5))}
            </text>
            {vertical && (
              <text
                x={c.x}
                y={c.y - NODE_RADIUS - 0.2}
                textAnchor="middle"
                fontFamily={FONT}
                fontSize="0.26"
                fontWeight="700"
                fill="#2563eb"
                pointerEvents="none"
              >
                ↕ {vertical.join(', ')}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
