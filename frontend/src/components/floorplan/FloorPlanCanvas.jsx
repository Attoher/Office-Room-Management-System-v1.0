import { forwardRef } from 'react';
import {
  exteriorSegments,
  furnitureRect,
  furnitureShapes,
  windowGeometry,
} from '../../domain/elements';
import { doorSwingInto, doorType, geometryOfDoor, rectCenter } from '../../domain/geometry';
import { getOccupancyStatus } from '../../domain/occupancy';

// Semua ukuran dalam meter (1 unit SVG = 1 m). Gaya mengikuti gambar kerja arsitek:
// dinding luar tebal, dinding dalam tipis, bukaan pintu/jendela memotong dinding.
const FONT = 'Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif';
const WALL = '#1e293b';
const WALL_WIDTH = 0.12;
const EXTERIOR_WALL_WIDTH = 0.28;
const OPENING_WIDTH = EXTERIOR_WALL_WIDTH + 0.04; // celah bukaan menutup dinding paling tebal
const FURNITURE_STROKE = '#64748b';
const STATUS_FILL = { hijau: '#ecfdf5', kuning: '#fef9c3', merah: '#fee2e2' };
const STATUS_TEXT = { hijau: '#047857', kuning: '#a16207', merah: '#b91c1c' };
const ROLE = {
  start: { fill: '#dbeafe', stroke: '#2563eb', label: 'ASAL' },
  target: { fill: '#e2e8f0', stroke: '#0f172a', label: 'TUJUAN' },
};
const OUTDOOR_EDGE = '#16a34a';
const SELECTED = '#2563eb';

function roomFill(room, status) {
  if (room.tipe === 'lorong') return '#f8fafc';
  if (room.tipe === 'luar') return status === 'hijau' ? 'url(#plan-outdoor)' : STATUS_FILL[status];
  return STATUS_FILL[status];
}

function truncate(text, width, fontSize) {
  const max = Math.max(3, Math.floor((width - 0.4) / (fontSize * 0.55)));
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const formatMeters = (value) => `${Number(value.toFixed(2)).toLocaleString('id-ID')} m`;

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

/** Satu daun pintu berengsel di `pivot`, menutup ke `free`, membuka ke arah `normal`. */
function Leaf({ pivot, free, normal, length }) {
  const tip = { x: pivot.x + normal.x * length, y: pivot.y + normal.y * length };
  // Arah sapuan busur: searah jarum jam di SVG bila hasil kali silangnya positif
  const cross = (tip.x - pivot.x) * (free.y - pivot.y) - (tip.y - pivot.y) * (free.x - pivot.x);
  return (
    <>
      <line x1={pivot.x} y1={pivot.y} x2={tip.x} y2={tip.y} stroke="#475569" strokeWidth="0.05" />
      <path
        d={`M ${tip.x} ${tip.y} A ${length} ${length} 0 0 ${cross > 0 ? 1 : 0} ${free.x} ${free.y}`}
        fill="none"
        stroke="#94a3b8"
        strokeWidth="0.03"
        strokeDasharray="0.08 0.06"
      />
    </>
  );
}

/** Celah pintu di dinding + simbol sesuai jenis pintu. */
function Door({ door, geometry, swingInto }) {
  const { wall, x1, y1, x2, y2 } = geometry;
  const type = doorType(door);
  const into = rectCenter(swingInto);
  const normal =
    wall.orientation === 'v'
      ? { x: into.x > wall.coord ? 1 : -1, y: 0 }
      : { x: 0, y: into.y > wall.coord ? 1 : -1 };
  const start = { x: x1, y: y1 };
  const end = { x: x2, y: y2 };
  const mid = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };

  let symbol = null;
  if (door.jenis === 'ganda') {
    const half = geometry.width / 2;
    symbol = (
      <>
        <Leaf pivot={start} free={mid} normal={normal} length={half} />
        <Leaf pivot={end} free={mid} normal={normal} length={half} />
      </>
    );
  } else if (door.jenis === 'geser') {
    // Panel geser digambar sejajar dinding, sedikit masuk ke ruangan
    const shift = { x: normal.x * 0.12, y: normal.y * 0.12 };
    symbol = (
      <>
        <line
          x1={x1 + shift.x}
          y1={y1 + shift.y}
          x2={mid.x + (mid.x - x1) * 0.2 + shift.x}
          y2={mid.y + (mid.y - y1) * 0.2 + shift.y}
          stroke="#475569"
          strokeWidth="0.06"
        />
        <line
          x1={mid.x - (x2 - mid.x) * 0.2 - shift.x}
          y1={mid.y - (y2 - mid.y) * 0.2 - shift.y}
          x2={x2 - shift.x}
          y2={y2 - shift.y}
          stroke="#475569"
          strokeWidth="0.06"
        />
      </>
    );
  } else if (type.swing) {
    const pivot = door.hinge === 'end' ? end : start;
    const free = door.hinge === 'end' ? start : end;
    symbol = <Leaf pivot={pivot} free={free} normal={normal} length={geometry.width} />;
  }

  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff" strokeWidth={OPENING_WIDTH} />
      {/* Kusen di kedua ujung bukaan */}
      {[start, end].map((p, i) => (
        <line
          key={i}
          x1={p.x - normal.x * 0.08}
          y1={p.y - normal.y * 0.08}
          x2={p.x + normal.x * 0.08}
          y2={p.y + normal.y * 0.08}
          stroke={WALL}
          strokeWidth="0.04"
        />
      ))}
      {symbol}
    </g>
  );
}

/** Jendela: celah dinding dengan tiga garis kaca sejajar. */
function Window({ geometry, selected }) {
  const { wall, x1, y1, x2, y2 } = geometry;
  const offsets = [-0.09, 0, 0.09];
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff" strokeWidth={OPENING_WIDTH} />
      {offsets.map((o) =>
        wall.orientation === 'v' ? (
          <line
            key={o}
            x1={x1 + o}
            y1={y1}
            x2={x2 + o}
            y2={y2}
            stroke={selected ? SELECTED : '#0ea5e9'}
            strokeWidth="0.03"
          />
        ) : (
          <line
            key={o}
            x1={x1}
            y1={y1 + o}
            x2={x2}
            y2={y2 + o}
            stroke={selected ? SELECTED : '#0ea5e9'}
            strokeWidth="0.03"
          />
        ),
      )}
    </g>
  );
}

function FurnitureShape({ shape }) {
  const common = { stroke: FURNITURE_STROKE, strokeWidth: 0.025 };
  if (shape.t === 'circle') {
    return <circle cx={shape.cx} cy={shape.cy} r={shape.r} fill="#ffffff" {...common} />;
  }
  if (shape.t === 'line') {
    return <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} {...common} />;
  }
  return (
    <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} fill="#ffffff" {...common} />
  );
}

/** Garis ukuran panjang & lebar ruangan, di dalam ruangan dekat sisi atas dan kiri. */
function Dimensions({ room }) {
  if (room.w < 2 || room.h < 2) return null;
  const inset = 0.35;
  const tick = 0.1;
  const style = { stroke: '#64748b', strokeWidth: 0.02 };
  const text = { fontFamily: FONT, fontSize: 0.24, fill: '#475569', textAnchor: 'middle' };
  const top = room.y + inset;
  const left = room.x + inset;
  return (
    <g pointerEvents="none">
      <line x1={room.x} y1={top} x2={room.x + room.w} y2={top} {...style} />
      <line x1={room.x} y1={top - tick} x2={room.x} y2={top + tick} {...style} />
      <line x1={room.x + room.w} y1={top - tick} x2={room.x + room.w} y2={top + tick} {...style} />
      <text x={room.x + room.w / 2} y={top - 0.06} {...text}>
        {formatMeters(room.w)}
      </text>
      <line x1={left} y1={room.y} x2={left} y2={room.y + room.h} {...style} />
      <line x1={left - tick} y1={room.y} x2={left + tick} y2={room.y} {...style} />
      <line
        x1={left - tick}
        y1={room.y + room.h}
        x2={left + tick}
        y2={room.y + room.h}
        {...style}
      />
      <text
        x={left - 0.06}
        y={room.y + room.h / 2}
        transform={`rotate(-90 ${left - 0.06} ${room.y + room.h / 2})`}
        {...text}
      >
        {formatMeters(room.h)}
      </text>
    </g>
  );
}

/**
 * Gambar denah satu lantai. Interaksi (klik, geser, gambar) diatur komponen induk lewat
 * prop event SVG, `onRoomPointerDown`, dan `onElementPointerDown`; `children` digambar paling
 * atas (overlay editor). `layers` mengatur lapisan opsional: { furniture, dimensions }.
 */
const FloorPlanCanvas = forwardRef(function FloorPlanCanvas(
  {
    rooms,
    doors,
    elements = [],
    roomsById,
    box,
    zoom = 1,
    startId,
    targetId,
    selectedId,
    selectedElementId,
    layers = { furniture: true, dimensions: false },
    routeSegments = [],
    verticalLabels = new Map(),
    onRoomPointerDown,
    onElementPointerDown,
    children,
    ...svgProps
  },
  ref,
) {
  // Hanya pintu & elemen milik lantai yang sedang digambar
  const shownRoomIds = new Set(rooms.map((room) => room.id));
  const floorId = rooms[0]?.lantai_id;
  const doorShapes = doors
    .map((door) => {
      if (!shownRoomIds.has(door.room_from) || !shownRoomIds.has(door.room_to)) return null;
      const geometry = geometryOfDoor(door, roomsById);
      return geometry && { door, geometry, swingInto: roomsById.get(doorSwingInto(door)) };
    })
    .filter(Boolean);
  const floorElements = elements.filter((e) =>
    e.room_id == null ? e.lantai_id === floorId : shownRoomIds.has(e.room_id),
  );
  const windows = floorElements
    .filter((e) => e.jenis === 'jendela')
    .map((e) => ({ element: e, geometry: windowGeometry(e, roomsById.get(e.room_id)) }))
    .filter((w) => w.geometry);
  const columns = floorElements.filter((e) => e.jenis === 'kolom');
  const furniture = floorElements.filter((e) => e.jenis === 'furnitur');

  // Area luar digambar lebih dulu agar batas putus-putusnya tidak menimpa dinding gedung
  const orderedRooms = [...rooms].sort(
    (a, b) => Number(b.tipe === 'luar') - Number(a.tipe === 'luar'),
  );
  const elementHandler = (element) =>
    onElementPointerDown ? (event) => onElementPointerDown(event, element) : undefined;

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
        {/* Rumput untuk area luar */}
        <pattern id="plan-outdoor" width="0.6" height="0.6" patternUnits="userSpaceOnUse">
          <rect width="0.6" height="0.6" fill="#f0fdf4" />
          <circle cx="0.15" cy="0.15" r="0.04" fill="#86efac" />
          <circle cx="0.45" cy="0.45" r="0.04" fill="#86efac" />
        </pattern>
      </defs>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="url(#plan-grid)" />

      {/* Lantai ruangan */}
      {orderedRooms.map((room) => {
        const role = room.id === startId ? ROLE.start : room.id === targetId ? ROLE.target : null;
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
              fill={role?.fill ?? roomFill(room, getOccupancyStatus(room))}
            />
            <TypeSymbol room={room} />
          </g>
        );
      })}

      {/* Furnitur di atas lantai, di bawah dinding */}
      {layers.furniture &&
        furniture.map((item) => {
          const room = roomsById.get(item.room_id);
          const selected = item.id === selectedElementId;
          const footprint = furnitureRect(item, room);
          return (
            <g
              key={item.id}
              onPointerDown={elementHandler(item)}
              style={{ cursor: onElementPointerDown ? 'move' : 'default' }}
            >
              {/* Bidang transparan supaya furnitur mudah diklik */}
              <rect
                x={footprint.x}
                y={footprint.y}
                width={footprint.w}
                height={footprint.h}
                fill="transparent"
                stroke={selected ? SELECTED : 'none'}
                strokeWidth="0.05"
                strokeDasharray="0.15 0.1"
              />
              {furnitureShapes(item, room).map((shape, index) => (
                <FurnitureShape key={index} shape={shape} />
              ))}
            </g>
          );
        })}

      {/* Dinding: tipis untuk dalam, tebal untuk luar; area luar tanpa dinding */}
      {orderedRooms.map((room) => {
        const role = room.id === startId ? ROLE.start : room.id === targetId ? ROLE.target : null;
        const outdoor = room.tipe === 'luar';
        return (
          <g key={room.id} pointerEvents="none">
            <rect
              x={room.x}
              y={room.y}
              width={room.w}
              height={room.h}
              fill="none"
              stroke={role?.stroke ?? (outdoor ? OUTDOOR_EDGE : WALL)}
              strokeWidth={role ? WALL_WIDTH * 1.6 : outdoor ? 0.06 : WALL_WIDTH}
              strokeDasharray={outdoor && !role ? '0.3 0.2' : undefined}
            />
            {!role &&
              exteriorSegments(room, rooms).map((s, i) => (
                <line
                  key={i}
                  x1={s.x1}
                  y1={s.y1}
                  x2={s.x2}
                  y2={s.y2}
                  stroke={WALL}
                  strokeWidth={EXTERIOR_WALL_WIDTH}
                  strokeLinecap="square"
                />
              ))}
          </g>
        );
      })}

      {/* Kolom struktur */}
      {columns.map((column) => (
        <rect
          key={column.id}
          x={column.x}
          y={column.y}
          width={column.w}
          height={column.h}
          fill={WALL}
          stroke={column.id === selectedElementId ? SELECTED : 'none'}
          strokeWidth="0.08"
          onPointerDown={elementHandler(column)}
          style={{ cursor: onElementPointerDown ? 'move' : 'default' }}
        />
      ))}

      {/* Bukaan: jendela & pintu memotong dinding */}
      {windows.map(({ element, geometry }) => (
        <g key={element.id}>
          <Window geometry={geometry} selected={element.id === selectedElementId} />
          {onElementPointerDown && (
            // Pegangan transparan selebar celah untuk memilih jendela
            <line
              x1={geometry.x1}
              y1={geometry.y1}
              x2={geometry.x2}
              y2={geometry.y2}
              stroke="transparent"
              strokeWidth="0.4"
              onPointerDown={elementHandler(element)}
              style={{ cursor: 'pointer' }}
            />
          )}
        </g>
      ))}
      {doorShapes.map(({ door, geometry, swingInto }) => (
        <Door key={door.id} door={door} geometry={geometry} swingInto={swingInto} />
      ))}

      {/* Label & ukuran ruangan paling atas agar tidak tertutup furnitur */}
      {orderedRooms.map((room) => {
        const status = getOccupancyStatus(room);
        const role = room.id === startId ? ROLE.start : room.id === targetId ? ROLE.target : null;
        const c = rectCenter(room);
        const nameSize = Math.min(0.5, Math.max(0.3, room.w / 9));
        const vertical = verticalLabels.get(room.id);
        const text = {
          fontFamily: FONT,
          textAnchor: 'middle',
          paintOrder: 'stroke',
          stroke: '#ffffff',
          strokeWidth: 0.08,
        };
        return (
          <g key={room.id} pointerEvents="none">
            {room.id === selectedId && (
              <rect
                x={room.x + 0.18}
                y={room.y + 0.18}
                width={room.w - 0.36}
                height={room.h - 0.36}
                fill="none"
                stroke={SELECTED}
                strokeWidth="0.08"
                strokeDasharray="0.25 0.15"
              />
            )}
            {layers.dimensions && <Dimensions room={room} />}
            {role && (
              <text
                x={c.x}
                y={room.y + 0.75}
                fontSize="0.3"
                fontWeight="800"
                fill={role.stroke}
                letterSpacing="0.04"
                {...text}
              >
                {role.label}
              </text>
            )}
            <text
              x={c.x}
              y={c.y - 0.05}
              fontSize={nameSize}
              fontWeight="700"
              fill="#0f172a"
              {...text}
            >
              {truncate(room.nama_ruangan, room.w, nameSize)}
            </text>
            <text
              x={c.x}
              y={c.y + nameSize + 0.05}
              fontSize={nameSize * 0.78}
              fontWeight="600"
              fill={STATUS_TEXT[status]}
              {...text}
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
                {...text}
              >
                {vertical}
              </text>
            )}
          </g>
        );
      })}

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
