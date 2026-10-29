import { exteriorSegments, furnitureShapes, windowGeometry } from '../elements';
import { doorSwingInto, doorType, geometryOfDoor, rectCenter } from '../geometry';

// Export denah satu lantai ke DXF R12 (AC1009), format teks yang dibaca semua versi AutoCAD.
// Satuan milimeter; sumbu Y DXF mengarah ke atas sehingga y denah dibalik.

export const DXF_LAYERS = {
  ruang: { name: 'A-RUANG', color: 7 },
  dindingLuar: { name: 'A-DINDING-LUAR', color: 7 },
  areaLuar: { name: 'A-AREA-LUAR', color: 3 },
  pintu: { name: 'A-PINTU', color: 1 },
  jendela: { name: 'A-JENDELA', color: 4 },
  kolom: { name: 'A-KOLOM', color: 8 },
  furnitur: { name: 'A-FURNITUR', color: 9 },
  teks: { name: 'A-TEKS', color: 2 },
};

const MM = 1000;
const fmt = (value) => Number(value.toFixed(3)).toString();
const px = (x) => fmt(x * MM);
const py = (y) => fmt(-y * MM);

class DxfWriter {
  constructor() {
    this.lines = [];
  }

  pair(code, value) {
    this.lines.push(String(code), String(value));
  }

  line(layer, a, b) {
    this.pair(0, 'LINE');
    this.pair(8, layer);
    this.pair(10, px(a.x));
    this.pair(20, py(a.y));
    this.pair(30, 0);
    this.pair(11, px(b.x));
    this.pair(21, py(b.y));
    this.pair(31, 0);
  }

  circle(layer, center, r) {
    this.pair(0, 'CIRCLE');
    this.pair(8, layer);
    this.pair(10, px(center.x));
    this.pair(20, py(center.y));
    this.pair(30, 0);
    this.pair(40, fmt(r * MM));
  }

  /** Busur berpusat di `center` dari titik `from` ke `to` (seperempat lingkaran). */
  arc(layer, center, from, to) {
    // Sudut di sistem DXF (y ke atas), dalam derajat
    const angle = (p) => (Math.atan2(-(p.y - center.y), p.x - center.x) * 180) / Math.PI;
    let start = angle(from);
    let end = angle(to);
    // DXF menggambar busur berlawanan jarum jam; pilih urutan yang menghasilkan sapuan terpendek
    const sweep = (((end - start) % 360) + 360) % 360;
    if (sweep > 180) [start, end] = [end, start];
    this.pair(0, 'ARC');
    this.pair(8, layer);
    this.pair(10, px(center.x));
    this.pair(20, py(center.y));
    this.pair(30, 0);
    this.pair(40, fmt(Math.hypot(from.x - center.x, from.y - center.y) * MM));
    this.pair(50, fmt((start + 360) % 360));
    this.pair(51, fmt((end + 360) % 360));
  }

  polygon(layer, points) {
    this.pair(0, 'POLYLINE');
    this.pair(8, layer);
    this.pair(66, 1);
    this.pair(70, 1); // tertutup
    for (const p of points) {
      this.pair(0, 'VERTEX');
      this.pair(8, layer);
      this.pair(10, px(p.x));
      this.pair(20, py(p.y));
      this.pair(30, 0);
    }
    this.pair(0, 'SEQEND');
    this.pair(8, layer);
  }

  rect(layer, r) {
    this.polygon(layer, [
      { x: r.x, y: r.y },
      { x: r.x + r.w, y: r.y },
      { x: r.x + r.w, y: r.y + r.h },
      { x: r.x, y: r.y + r.h },
    ]);
  }

  text(layer, at, height, value) {
    this.pair(0, 'TEXT');
    this.pair(8, layer);
    this.pair(10, px(at.x));
    this.pair(20, py(at.y));
    this.pair(30, 0);
    this.pair(40, fmt(height * MM));
    this.pair(1, value);
    this.pair(72, 1); // rata tengah
    this.pair(11, px(at.x));
    this.pair(21, py(at.y));
    this.pair(31, 0);
  }

  toString() {
    return `${this.lines.join('\n')}\n`;
  }
}

function writeDoor(w, door, geometry, swingInto) {
  const layer = DXF_LAYERS.pintu.name;
  const { wall, x1, y1, x2, y2 } = geometry;
  const into = rectCenter(swingInto);
  const normal =
    wall.orientation === 'v'
      ? { x: into.x > wall.coord ? 1 : -1, y: 0 }
      : { x: 0, y: into.y > wall.coord ? 1 : -1 };
  const start = { x: x1, y: y1 };
  const end = { x: x2, y: y2 };
  const mid = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  const leaf = (pivot, free, length) => {
    const tip = { x: pivot.x + normal.x * length, y: pivot.y + normal.y * length };
    w.line(layer, pivot, tip);
    w.arc(layer, pivot, tip, free);
  };

  // Kusen di kedua ujung bukaan
  for (const p of [start, end]) {
    w.line(
      layer,
      { x: p.x - normal.x * 0.1, y: p.y - normal.y * 0.1 },
      { x: p.x + normal.x * 0.1, y: p.y + normal.y * 0.1 },
    );
  }
  if (door.jenis === 'ganda') {
    leaf(start, mid, geometry.width / 2);
    leaf(end, mid, geometry.width / 2);
  } else if (door.jenis === 'geser') {
    const s = { x: normal.x * 0.1, y: normal.y * 0.1 };
    w.line(layer, { x: x1 + s.x, y: y1 + s.y }, { x: mid.x + s.x, y: mid.y + s.y });
    w.line(layer, { x: mid.x - s.x, y: mid.y - s.y }, { x: x2 - s.x, y: y2 - s.y });
  } else if (doorType(door).swing) {
    const pivot = door.hinge === 'end' ? end : start;
    const free = door.hinge === 'end' ? start : end;
    leaf(pivot, free, geometry.width);
  }
}

function writeLayers(w) {
  w.pair(0, 'SECTION');
  w.pair(2, 'TABLES');
  w.pair(0, 'TABLE');
  w.pair(2, 'LTYPE');
  w.pair(70, 1);
  w.pair(0, 'LTYPE');
  w.pair(2, 'CONTINUOUS');
  w.pair(70, 0);
  w.pair(3, 'Solid line');
  w.pair(72, 65);
  w.pair(73, 0);
  w.pair(40, 0);
  w.pair(0, 'ENDTAB');
  const layers = Object.values(DXF_LAYERS);
  w.pair(0, 'TABLE');
  w.pair(2, 'LAYER');
  w.pair(70, layers.length);
  for (const layer of layers) {
    w.pair(0, 'LAYER');
    w.pair(2, layer.name);
    w.pair(70, 0);
    w.pair(62, layer.color);
    w.pair(6, 'CONTINUOUS');
  }
  w.pair(0, 'ENDTAB');
  w.pair(0, 'ENDSEC');
}

/**
 * Isi file DXF untuk satu lantai: ruangan (garis batas + dinding luar), pintu, jendela,
 * kolom, furnitur, dan teks nama ruangan.
 */
export function floorToDxf({ floorId, rooms, doors, elements, roomsById }) {
  const floorRooms = rooms.filter((r) => r.lantai_id === floorId);
  const shown = new Set(floorRooms.map((r) => r.id));
  const w = new DxfWriter();

  w.pair(0, 'SECTION');
  w.pair(2, 'HEADER');
  w.pair(9, '$ACADVER');
  w.pair(1, 'AC1009');
  w.pair(9, '$INSUNITS');
  w.pair(70, 4); // milimeter
  w.pair(0, 'ENDSEC');
  writeLayers(w);
  w.pair(0, 'SECTION');
  w.pair(2, 'ENTITIES');

  for (const room of floorRooms) {
    w.rect(room.tipe === 'luar' ? DXF_LAYERS.areaLuar.name : DXF_LAYERS.ruang.name, room);
    for (const s of exteriorSegments(room, floorRooms)) {
      w.line(DXF_LAYERS.dindingLuar.name, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 });
    }
    const c = rectCenter(room);
    w.text(DXF_LAYERS.teks.name, c, 0.3, room.nama_ruangan);
    w.text(DXF_LAYERS.teks.name, { x: c.x, y: c.y + 0.45 }, 0.2, `${room.luas} m2`);
  }

  for (const door of doors) {
    if (!shown.has(door.room_from) || !shown.has(door.room_to)) continue;
    const geometry = geometryOfDoor(door, roomsById);
    if (geometry) writeDoor(w, door, geometry, roomsById.get(doorSwingInto(door)));
  }

  for (const element of elements) {
    if (element.room_id != null ? !shown.has(element.room_id) : element.lantai_id !== floorId) {
      continue;
    }
    if (element.jenis === 'kolom') {
      w.rect(DXF_LAYERS.kolom.name, element);
    } else if (element.jenis === 'jendela') {
      const g = windowGeometry(element, roomsById.get(element.room_id));
      if (!g) continue;
      for (const o of [-0.08, 0, 0.08]) {
        const d = g.wall.orientation === 'v' ? { x: o, y: 0 } : { x: 0, y: o };
        w.line(
          DXF_LAYERS.jendela.name,
          { x: g.x1 + d.x, y: g.y1 + d.y },
          { x: g.x2 + d.x, y: g.y2 + d.y },
        );
      }
    } else if (element.jenis === 'furnitur') {
      for (const shape of furnitureShapes(element, roomsById.get(element.room_id))) {
        const layer = DXF_LAYERS.furnitur.name;
        if (shape.t === 'circle') w.circle(layer, { x: shape.cx, y: shape.cy }, shape.r);
        else if (shape.t === 'line') {
          w.line(layer, { x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 });
        } else w.rect(layer, shape);
      }
    }
  }

  w.pair(0, 'ENDSEC');
  w.pair(0, 'EOF');
  return w.toString();
}
