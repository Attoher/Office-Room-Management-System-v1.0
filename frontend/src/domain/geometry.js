// Geometri denah. Satuan meter; posisi & ukuran ruangan selalu kelipatan GRID.
export const GRID = 0.5;
export const DOOR_WIDTH = 0.9;
/** Dinding bersama minimal agar muat satu pintu. */
export const MIN_DOOR_WALL = 1;
export const MIN_ROOM_SIDE = 1;
export const MAX_COORD = 500;

/** Tipe ruangan. Tangga & lift bisa dihubungkan ke tangga/lift di lantai lain. */
export const ROOM_TYPES = {
  ruangan: { label: 'Ruangan' },
  lorong: { label: 'Lorong' },
  tangga: { label: 'Tangga', vertical: true },
  lift: { label: 'Lift', vertical: true },
};

const EPS = 1e-6;

export const snapToGrid = (value) => Math.round(value / GRID) * GRID;

export const rectCenter = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export const isVerticalType = (tipe) => Boolean(ROOM_TYPES[tipe]?.vertical);

/** Bertumpuk bila bagian dalamnya beririsan (sekadar bersentuhan dinding tidak dihitung). */
export function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS
  );
}

/**
 * Dinding bersama dua ruangan di lantai yang sama.
 * orientation 'v' = dinding tegak (x tetap), 'h' = dinding mendatar (y tetap).
 * start/end adalah rentang sepanjang dinding. null bila tidak bersebelahan.
 */
export function sharedWall(a, b) {
  if (a.lantai_id !== b.lantai_id) return null;

  const vx =
    Math.abs(a.x + a.w - b.x) < EPS ? a.x + a.w : Math.abs(b.x + b.w - a.x) < EPS ? a.x : null;
  if (vx !== null) {
    const start = Math.max(a.y, b.y);
    const end = Math.min(a.y + a.h, b.y + b.h);
    if (end - start > EPS) return { orientation: 'v', coord: vx, start, end, length: end - start };
  }

  const hy =
    Math.abs(a.y + a.h - b.y) < EPS ? a.y + a.h : Math.abs(b.y + b.h - a.y) < EPS ? a.y : null;
  if (hy !== null) {
    const start = Math.max(a.x, b.x);
    const end = Math.min(a.x + a.w, b.x + b.w);
    if (end - start > EPS) return { orientation: 'h', coord: hy, start, end, length: end - start };
  }

  return null;
}

/** Semua pasangan ruangan yang berbagi dinding: Map roomId → [{ roomId, wall }]. */
export function findNeighbors(rooms) {
  const neighbors = new Map(rooms.map((room) => [room.id, []]));
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      const wall = sharedWall(rooms[i], rooms[j]);
      if (wall) {
        neighbors.get(rooms[i].id).push({ roomId: rooms[j].id, wall });
        neighbors.get(rooms[j].id).push({ roomId: rooms[i].id, wall });
      }
    }
  }
  return neighbors;
}

/** Posisi pintu dibatasi supaya daun pintu tidak keluar dari dinding bersama. */
export function clampDoorOffset(wall, offset) {
  const half = DOOR_WIDTH / 2;
  const min = half;
  const max = wall.length - half;
  if (max < min) return wall.length / 2;
  return Math.min(max, Math.max(min, offset ?? wall.length / 2));
}

/**
 * Bentuk pintu horizontal (dalam satu lantai). `offset` diukur dari awal dinding bersama
 * ke tengah pintu. null bila dinding bersama sudah tidak ada atau terlalu pendek.
 */
export function doorGeometry(a, b, offset) {
  const wall = sharedWall(a, b);
  if (!wall || wall.length < MIN_DOOR_WALL - EPS) return null;
  const at = wall.start + clampDoorOffset(wall, offset);
  const half = DOOR_WIDTH / 2;
  return wall.orientation === 'v'
    ? {
        wall,
        point: { x: wall.coord, y: at },
        x1: wall.coord,
        y1: at - half,
        x2: wall.coord,
        y2: at + half,
      }
    : {
        wall,
        point: { x: at, y: wall.coord },
        x1: at - half,
        y1: wall.coord,
        x2: at + half,
        y2: wall.coord,
      };
}

/** Offset pintu dari titik sembarang (mis. posisi pointer saat menggeser pintu). */
export function offsetFromPoint(wall, point) {
  const along = wall.orientation === 'v' ? point.y : point.x;
  return clampDoorOffset(wall, along - wall.start);
}

/**
 * Validasi posisi & ukuran ruangan terhadap ruangan lain di lantai yang sama.
 * Mengembalikan pesan error atau null.
 */
export function geometryError(rect, otherRooms) {
  if (rect.w < MIN_ROOM_SIDE || rect.h < MIN_ROOM_SIDE) {
    return `Sisi ruangan minimal ${MIN_ROOM_SIDE} m.`;
  }
  if ([rect.x, rect.y, rect.x + rect.w, rect.y + rect.h].some((v) => Math.abs(v) > MAX_COORD)) {
    return 'Ruangan terlalu jauh dari area denah.';
  }
  const clash = otherRooms.find(
    (other) =>
      other.id !== rect.id && other.lantai_id === rect.lantai_id && rectsOverlap(rect, other),
  );
  return clash ? `Bertumpuk dengan ${clash.nama_ruangan}.` : null;
}

/**
 * Titik garis jalur tamu, dipecah per lantai: Map lantai_id → [[{x, y}, ...], ...].
 * Dalam satu lantai garis lewat tengah ruangan dan pintu; saat pindah lantai lewat tangga/lift
 * garis berhenti di tengah tangga dan berlanjut dari tangga di lantai tujuan.
 */
export function routeSegmentsByFloor(roomIds, roomsById, doors) {
  const doorByPair = new Map(doors.map((d) => [`${d.room_from}_${d.room_to}`, d]));
  const segments = new Map();
  let current = null;

  roomIds.forEach((id, index) => {
    const room = roomsById.get(id);
    const previous = index > 0 ? roomsById.get(roomIds[index - 1]) : null;
    if (!previous || previous.lantai_id !== room.lantai_id) {
      current = [];
      if (!segments.has(room.lantai_id)) segments.set(room.lantai_id, []);
      segments.get(room.lantai_id).push(current);
    } else {
      const pair = `${Math.min(previous.id, id)}_${Math.max(previous.id, id)}`;
      const geometry = doorGeometry(previous, room, doorByPair.get(pair)?.offset);
      if (geometry) current.push(geometry.point);
    }
    current.push(rectCenter(room));
  });

  return segments;
}

export function planBounds(rooms, padding = 2) {
  if (rooms.length === 0) return { x: -padding, y: -padding, w: 20, h: 14 };
  const minX = Math.min(...rooms.map((r) => r.x));
  const minY = Math.min(...rooms.map((r) => r.y));
  const maxX = Math.max(...rooms.map((r) => r.x + r.w));
  const maxY = Math.max(...rooms.map((r) => r.y + r.h));
  return {
    x: minX - padding,
    y: minY - padding,
    w: maxX - minX + padding * 2,
    h: maxY - minY + padding * 2,
  };
}
