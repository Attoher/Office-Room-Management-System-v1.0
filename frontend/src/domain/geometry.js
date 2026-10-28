// Geometri denah. Satuan meter; posisi & ukuran ruangan selalu kelipatan GRID.
export const GRID = 0.5;
export const DOOR_WIDTH = 0.9;
/** Jarak minimal tepi pintu ke ujung dinding bersama (sudut atau sambungan dinding lain). */
export const END_CLEARANCE = 0.1;
/** Tiang minimal di antara dua pintu yang segaris. */
export const MIN_PIER = 0.2;
/** Dinding bersama minimal agar muat satu pintu beserta jarak ke ujungnya. */
export const MIN_DOOR_WALL = DOOR_WIDTH + END_CLEARANCE * 2;
export const MIN_ROOM_SIDE = 1;
export const MAX_COORD = 500;
const OFFSET_STEP = 0.1;

/**
 * Tipe ruangan. Tangga & lift bisa dihubungkan ke tangga/lift di lantai lain.
 * Area luar (taman, parkir, teras) berada di luar gedung tapi tetap bisa dilewati tamu.
 */
export const ROOM_TYPES = {
  ruangan: { label: 'Ruangan' },
  lorong: { label: 'Lorong' },
  tangga: { label: 'Tangga', vertical: true },
  lift: { label: 'Lift', vertical: true },
  luar: { label: 'Area luar' },
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

/** Posisi pintu dibatasi supaya tetap di dalam dinding bersama dan tidak menempel ke ujungnya. */
export function clampDoorOffset(wall, offset) {
  const min = DOOR_WIDTH / 2 + END_CLEARANCE;
  const max = wall.length - min;
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

/** Ruangan tempat daun pintu membuka; bawaan: room_to. */
export const doorSwingInto = (door) => door.swing_into ?? door.room_to;

/**
 * Daerah sapuan daun pintu: persegi selebar pintu di sisi ruangan tempat pintu membuka.
 * Dipakai untuk mendeteksi dua daun pintu yang saling bertabrakan.
 */
function swingArea(geometry, intoRoom) {
  const { wall, x1, y1, x2, y2 } = geometry;
  const center = rectCenter(intoRoom);
  if (wall.orientation === 'v') {
    const dir = center.x > wall.coord ? 1 : -1;
    return { x: dir > 0 ? wall.coord : wall.coord - DOOR_WIDTH, y: y1, w: DOOR_WIDTH, h: y2 - y1 };
  }
  const dir = center.y > wall.coord ? 1 : -1;
  return { x: x1, y: dir > 0 ? wall.coord : wall.coord - DOOR_WIDTH, w: x2 - x1, h: DOOR_WIDTH };
}

/**
 * Cek apakah pintu bertabrakan dengan pintu lain di lantai yang sama.
 * - celah pintu yang segaris harus berjarak ≥ MIN_PIER (ada tiang di antaranya)
 * - daun pintu yang membuka ke ruangan yang sama tidak boleh saling menyapu
 * Mengembalikan pesan error atau null. `door.id` dipakai untuk mengecualikan dirinya sendiri.
 */
export function doorPlacementError(door, doors, roomsById) {
  const a = roomsById.get(door.room_from);
  const b = roomsById.get(door.room_to);
  if (!a || !b || a.lantai_id !== b.lantai_id) return null;
  const geometry = doorGeometry(a, b, door.offset);
  if (!geometry) return `Dinding bersama minimal ${MIN_DOOR_WALL} m untuk pintu.`;
  const swing = swingArea(geometry, roomsById.get(doorSwingInto(door)));
  const along = (g) => (g.wall.orientation === 'v' ? [g.y1, g.y2] : [g.x1, g.x2]);
  const [from, to] = along(geometry);

  for (const other of doors) {
    if (other.id === door.id) continue;
    const oa = roomsById.get(other.room_from);
    const ob = roomsById.get(other.room_to);
    if (!oa || !ob || oa.lantai_id !== a.lantai_id || ob.lantai_id !== a.lantai_id) continue;
    const og = doorGeometry(oa, ob, other.offset);
    if (!og) continue;
    const label = `${oa.nama_ruangan}–${ob.nama_ruangan}`;

    if (
      og.wall.orientation === geometry.wall.orientation &&
      Math.abs(og.wall.coord - geometry.wall.coord) < EPS
    ) {
      const [ofrom, oto] = along(og);
      if (from < oto + MIN_PIER - EPS && ofrom < to + MIN_PIER - EPS) {
        return `Terlalu dekat dengan pintu ${label} (tiang minimal ${MIN_PIER} m).`;
      }
    }

    if (doorSwingInto(other) === doorSwingInto(door)) {
      const otherSwing = swingArea(og, roomsById.get(doorSwingInto(other)));
      if (rectsOverlap(swing, otherSwing)) return `Daun pintu bertabrakan dengan pintu ${label}.`;
    }
  }
  return null;
}

/** Posisi pintu baru yang tidak bertabrakan, dicari dari tengah dinding ke arah luar. null bila penuh. */
export function findFreeDoorOffset(door, doors, roomsById) {
  const wall = sharedWall(roomsById.get(door.room_from), roomsById.get(door.room_to));
  if (!wall || wall.length < MIN_DOOR_WALL - EPS) return null;
  const center = wall.length / 2;
  const steps = Math.ceil(wall.length / OFFSET_STEP);
  for (let i = 0; i <= steps; i += 1) {
    const delta = Math.ceil(i / 2) * OFFSET_STEP * (i % 2 === 0 ? -1 : 1);
    const offset = clampDoorOffset(wall, center + delta);
    if (!doorPlacementError({ ...door, offset }, doors, roomsById)) {
      return Math.round(offset * 100) / 100;
    }
  }
  return null;
}

/** Pintu terdekat (jarak tengah ruangan → pintu → tengah ruangan) di antara dua ruangan. */
export function bestDoorBetween(a, b, doors) {
  let best = null;
  for (const door of doors) {
    const matches =
      (door.room_from === a.id && door.room_to === b.id) ||
      (door.room_from === b.id && door.room_to === a.id);
    if (!matches) continue;
    const geometry = doorGeometry(a, b, door.offset);
    if (!geometry) continue;
    const ca = rectCenter(a);
    const cb = rectCenter(b);
    const length =
      Math.hypot(ca.x - geometry.point.x, ca.y - geometry.point.y) +
      Math.hypot(geometry.point.x - cb.x, geometry.point.y - cb.y);
    if (!best || length < best.length) best = { door, geometry, length };
  }
  return best;
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
      // Sama dengan pathfinding: bila ada beberapa pintu, yang terdekat yang dipakai
      const best = bestDoorBetween(previous, room, doors);
      if (best) current.push(best.geometry.point);
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
