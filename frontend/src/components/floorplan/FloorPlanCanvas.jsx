import { forwardRef } from 'react';
import { DOOR_WIDTH, doorGeometry, rectCenter } from '../../domain/geometry';
import { getOccupancyStatus } from '../../domain/occupancy';

// Semua ukuran dalam meter (1 unit SVG = 1 m)
const FONT = 'Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif';
const WALL = '#334155';
const WALL_WIDTH = 0.14;
const STATUS_FILL = { hijau: '#ecfdf5', kuning: '#fef9c3', merah: '#fee2e2' };
const STATUS_TEXT = { hijau: '#047857', kuning: '#a16207', merah: '#b91c1c' };
const ROLE = {
  start: { fill: '#dbeafe', stroke: '#2563eb', label: 'ASAL' },
  target: { fill: '#e2e8f0', stroke: '#0f172a', label: 'TUJUAN' },
};

function truncate(text, width, fontSize) {
  const max = Math.max(3, Math.floor((width - 0.4) / (fontSize * 0.55)));
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Simbol tangga (anak tangga) dan lift (tanda silang) di dalam ruangan. */
function TypeSymbol({ room }) {
  const inset = 0.3;
  if (room.tipe === 'tangga') {
    const steps = Math.max(3, Math.floor((room.w - inset * 2) / 0.4));
    const gap = (room.w - inset * 2) / steps;
    return (
      <g stroke="#94a3b8" strokeWidth="0.04">
        {Array.from({ length: steps + 1 }, (_, i) => (
          <line
            key={i}
            x1={room.x + inset + i * gap}
            y1={room.y + inset}
            x2={room.x + inset + i * gap}
            y2={room.y + room.h - inset}
          />
        ))}
      </g>
    );
  }
  if (room.tipe === 'lift') {
    return (
      <g stroke="#94a3b8" strokeWidth="0.05">
        <line
          x1={room.x + inset}
          y1={room.y + inset}
          x2={room.x + room.w - inset}
          y2={room.y + room.h - inset}
        />
        <line
          x1={room.x + room.w - inset}
          y1={room.y + inset}
          x2={room.x + inset}
          y2={room.y + room.h - inset}
        />
      </g>
    );
  }
  return null;
}

/** Celah pintu di dinding + daun pintu yang membuka ke ruangan `room_to`. */
function Door({ geometry, swingInto }) {
  const { wall, x1, y1, x2, y2 } = geometry;
  const into = rectCenter(swingInto);
  let leaf;
  let arc;
  if (wall.orientation === 'v') {
    const dir = into.x > wall.coord ? 1 : -1;
    const tip = { x: x1 + dir * DOOR_WIDTH, y: y1 };
    leaf = { x2: tip.x, y2: tip.y };
    arc = `M ${tip.x} ${tip.y} A ${DOOR_WIDTH} ${DOOR_WIDTH} 0 0 ${dir > 0 ? 1 : 0} ${x2} ${y2}`;
  } else {
    const dir = into.y > wall.coord ? 1 : -1;
    const tip = { x: x1, y: y1 + dir * DOOR_WIDTH };
    leaf = { x2: tip.x, y2: tip.y };
    arc = `M ${tip.x} ${tip.y} A ${DOOR_WIDTH} ${DOOR_WIDTH} 0 0 ${dir > 0 ? 0 : 1} ${x2} ${y2}`;
  }
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff" strokeWidth={WALL_WIDTH + 0.06} />
      <line x1={x1} y1={y1} {...leaf} stroke="#64748b" strokeWidth="0.05" />
      <path d={arc} fill="none" stroke="#94a3b8" strokeWidth="0.03" strokeDasharray="0.08 0.06" />
    </g>
  );
}

/**
 * Gambar denah satu lantai. Interaksi (klik, geser, gambar) diatur komponen induk lewat
 * prop event SVG dan `onRoomPointerDown`; `children` digambar paling atas (overlay editor).
 */
const FloorPlanCanvas = forwardRef(function FloorPlanCanvas(
  {
    rooms,
    doors,
    roomsById,
    box,
    zoom = 1,
    startId,
    targetId,
    selectedId,
    routeSegments = [],
    verticalLabels = new Map(),
    onRoomPointerDown,
    children,
    ...svgProps
  },
  ref,
) {
  const doorShapes = doors
    .map((door) => {
      const a = roomsById.get(door.room_from);
      const b = roomsById.get(door.room_to);
      if (!a || !b || a.lantai_id !== b.lantai_id) return null;
      const geometry = doorGeometry(a, b, door.offset);
      return geometry && { door, geometry, swingInto: b };
    })
    .filter(Boolean);

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, touchAction: 'none' }}
      role="img"
      aria-label="Denah lantai"
      {...svgProps}
    >
      <defs>
        <pattern id="plan-grid-minor" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
          <path d="M 0.5 0 L 0 0 0 0.5" fill="none" stroke="#f1f5f9" strokeWidth="0.02" />
        </pattern>
        <pattern id="plan-grid" width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="url(#plan-grid-minor)" />
          <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#e2e8f0" strokeWidth="0.04" />
        </pattern>
      </defs>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="url(#plan-grid)" />

      {rooms.map((room) => {
        const status = getOccupancyStatus(room);
        const role = room.id === startId ? ROLE.start : room.id === targetId ? ROLE.target : null;
        const selected = room.id === selectedId;
        const c = rectCenter(room);
        const nameSize = Math.min(0.5, Math.max(0.3, room.w / 9));
        const vertical = verticalLabels.get(room.id);
        return (
          <g
            key={room.id}
            onPointerDown={
              onRoomPointerDown ? (event) => onRoomPointerDown(event, room) : undefined
            }
            style={{ cursor: onRoomPointerDown ? 'pointer' : 'default' }}
          >
            <title>{`${room.nama_ruangan} · ${room.occupancy}/${room.kapasitas_max} orang · ${room.luas} m²`}</title>
            <rect
              x={room.x}
              y={room.y}
              width={room.w}
              height={room.h}
              fill={role?.fill ?? (room.tipe === 'lorong' ? '#f8fafc' : STATUS_FILL[status])}
            />
            <TypeSymbol room={room} />
            <rect
              x={room.x}
              y={room.y}
              width={room.w}
              height={room.h}
              fill="none"
              stroke={role?.stroke ?? WALL}
              strokeWidth={role ? WALL_WIDTH * 1.6 : WALL_WIDTH}
            />
            {selected && (
              <rect
                x={room.x + 0.12}
                y={room.y + 0.12}
                width={room.w - 0.24}
                height={room.h - 0.24}
                fill="none"
                stroke="#2563eb"
                strokeWidth="0.08"
                strokeDasharray="0.25 0.15"
                pointerEvents="none"
              />
            )}
            <g pointerEvents="none" fontFamily={FONT} textAnchor="middle">
              {role && (
                <text
                  x={c.x}
                  y={room.y + 0.55}
                  fontSize="0.3"
                  fontWeight="800"
                  fill={role.stroke}
                  letterSpacing="0.04"
                >
                  {role.label}
                </text>
              )}
              <text x={c.x} y={c.y - 0.05} fontSize={nameSize} fontWeight="700" fill="#0f172a">
                {truncate(room.nama_ruangan, room.w, nameSize)}
              </text>
              <text
                x={c.x}
                y={c.y + nameSize + 0.05}
                fontSize={nameSize * 0.78}
                fontWeight="600"
                fill={STATUS_TEXT[status]}
              >
                {room.occupancy}/{room.kapasitas_max} · {room.luas} m²
              </text>
              {vertical && (
                <text
                  x={c.x}
                  y={room.y + room.h - 0.35}
                  fontSize="0.28"
                  fontWeight="700"
                  fill="#475569"
                >
                  {vertical}
                </text>
              )}
            </g>
          </g>
        );
      })}

      {doorShapes.map(({ door, geometry, swingInto }) => (
        <Door key={door.id} geometry={geometry} swingInto={swingInto} />
      ))}

      {routeSegments.map((points, index) => (
        <g key={index} pointerEvents="none">
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#2563eb"
            strokeWidth="0.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="0.45 0.3"
            className="route-line"
          />
          <circle cx={points[0].x} cy={points[0].y} r="0.28" fill="#2563eb" />
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="0.28"
            fill="#0f172a"
          />
        </g>
      ))}

      {children}
    </svg>
  );
});

export default FloorPlanCanvas;
