import { GRID, MIN_ROOM_SIDE, rectsOverlap, sharedWall, snapToGrid } from '../geometry';

// Import denah dari DXF (hasil dxf-parser). Ruangan diambil dari polyline tertutup di satu layer,
// nama dari TEXT/MTEXT di dalamnya, pintu dari ARC (busur ayunan daun pintu) di layer pintu.
// Aplikasi hanya mengenal ruangan kotak, jadi bentuk lain didekati dengan kotak pembatasnya.

export const UNIT_SCALES = { mm: 0.001, cm: 0.01, m: 1 };
const INSUNITS_TO_UNIT = { 4: 'mm', 5: 'cm', 6: 'm' };
const EPS = 1e-6;

const isClosedPolyline = (e) =>
  (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') &&
  e.vertices?.length >= 3 &&
  (e.shape ||
    (Math.abs(e.vertices[0].x - e.vertices.at(-1).x) < EPS &&
      Math.abs(e.vertices[0].y - e.vertices.at(-1).y) < EPS));

const textOf = (e) =>
  e.type === 'MTEXT'
    ? cleanMText(e.text ?? '')
    : e.type === 'TEXT'
      ? String(e.text ?? '').trim()
      : null;
const textPoint = (e) => e.position ?? e.startPoint ?? e.endPoint;

/** Bersihkan kode format MTEXT ({\fArial;...}, \P, \A1; dll.) menjadi teks biasa. */
export function cleanMText(text) {
  return text
    .replace(/\\P/g, ' ')
    .replace(/\\[A-Za-z][^;\\{}]*;/g, '')
    .replace(/[{}]/g, '')
    .replace(/\\~/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ringkasan layer: jumlah polyline tertutup, teks, dan busur per layer, plus tebakan satuan. */
export function analyzeDxf(dxf) {
  const layers = new Map();
  let maxExtent = 0;
  for (const e of dxf.entities ?? []) {
    const name = e.layer ?? '0';
    if (!layers.has(name)) layers.set(name, { name, polylines: 0, texts: 0, arcs: 0 });
    const layer = layers.get(name);
    if (isClosedPolyline(e)) {
      layer.polylines += 1;
      for (const v of e.vertices) maxExtent = Math.max(maxExtent, Math.abs(v.x), Math.abs(v.y));
    } else if (textOf(e)) layer.texts += 1;
    else if (e.type === 'ARC') layer.arcs += 1;
  }
  const list = [...layers.values()].sort((a, b) => a.name.localeCompare(b.name));

  const headerUnit = INSUNITS_TO_UNIT[dxf.header?.$INSUNITS];
  // Tanpa keterangan satuan: denah kantor puluhan meter → angka ribuan berarti milimeter
  const unit = headerUnit ?? (maxExtent > 2000 ? 'mm' : maxExtent > 200 ? 'cm' : 'm');

  const pick = (score) =>
    list
      .map((layer) => ({ layer, value: score(layer) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)[0]?.layer.name ?? '';
  return {
    layers: list,
    unit,
    guess: {
      roomLayer: pick((l) => l.polylines * (/ruang|room|area|space|rng/i.test(l.name) ? 10 : 1)),
      textLayer: pick((l) => l.texts * (/teks|text|nama|name|label|tag/i.test(l.name) ? 10 : 1)),
      doorLayer: pick((l) => l.arcs * (/pintu|door|dr/i.test(l.name) ? 10 : 1)),
    },
  };
}

/**
 * Rapatkan celah dinding: sisi dua ruangan yang berhadapan dengan jarak ≤ tolerance (tebal
 * dinding) dipindah ke garis tengahnya, sehingga dikenali sebagai tetangga.
 */
function closeWallGaps(rects, tolerance) {
  const result = rects.map((r) => ({ ...r }));
  const overlapLength = (a1, a2, b1, b2) => Math.min(a2, b2) - Math.max(a1, b1);
  for (let i = 0; i < result.length; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      if (i === j) continue;
      const a = result[i];
      const b = result[j];
      // sisi kanan a berhadapan dengan sisi kiri b
      const gapX = b.x - (a.x + a.w);
      if (gapX > EPS && gapX <= tolerance && overlapLength(a.y, a.y + a.h, b.y, b.y + b.h) > 0.3) {
        const mid = a.x + a.w + gapX / 2;
        a.w = mid - a.x;
        b.w = b.x + b.w - mid;
        b.x = mid;
      }
      // sisi bawah a berhadapan dengan sisi atas b
      const gapY = b.y - (a.y + a.h);
      if (gapY > EPS && gapY <= tolerance && overlapLength(a.x, a.x + a.w, b.x, b.x + b.w) > 0.3) {
        const mid = a.y + a.h + gapY / 2;
        a.h = mid - a.y;
        b.h = b.y + b.h - mid;
        b.y = mid;
      }
    }
  }
  return result;
}

/**
 * Ambil ruangan & pintu dari DXF.
 * options: { roomLayer, textLayer, doorLayer, unit, wallTolerance (meter) }
 * Hasil (meter, y ke bawah, dimulai dari 0,0):
 *   rooms: [{ nama, x, y, w, h, approximated }]
 *   doors: [{ a, b, offset }]   (a, b = indeks di rooms)
 *   warnings: [string]
 */
export function extractPlan(
  dxf,
  { roomLayer, textLayer, doorLayer, unit = 'mm', wallTolerance = 0.3 },
) {
  const scale = UNIT_SCALES[unit];
  const toPlan = (p) => ({ x: p.x * scale, y: -p.y * scale });
  const entities = dxf.entities ?? [];
  const warnings = [];

  // 1. Ruangan dari polyline tertutup
  let rects = entities
    .filter((e) => e.layer === roomLayer && isClosedPolyline(e))
    .map((e) => {
      const points = e.vertices.map(toPlan);
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      const rect = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys),
      };
      // Kotak sejati = tepat 4 titik berbeda dan semuanya di sudut kotak pembatas
      const distinct = [
        ...new Map(points.map((p) => [`${p.x.toFixed(3)},${p.y.toFixed(3)}`, p])).values(),
      ];
      const atCorner = (p) =>
        (Math.abs(p.x - rect.x) < 0.01 || Math.abs(p.x - rect.x - rect.w) < 0.01) &&
        (Math.abs(p.y - rect.y) < 0.01 || Math.abs(p.y - rect.y - rect.h) < 0.01);
      return { ...rect, approximated: !(distinct.length === 4 && distinct.every(atCorner)) };
    })
    .filter((r) => r.w > 0.2 && r.h > 0.2);

  if (rects.length === 0) {
    return { rooms: [], doors: [], warnings: ['Tidak ada polyline tertutup di layer ruangan.'] };
  }

  // 2. Nama dari teks di dalam kotak (sebelum dirapikan, agar tidak meleset ke tetangga)
  const texts = entities
    .filter((e) => e.layer === textLayer && textOf(e) && textPoint(e))
    .map((e) => ({
      value: textOf(e),
      at: toPlan(textPoint(e)),
      height: e.textHeight ?? e.height ?? 0,
    }));
  const names = rects.map((r) => {
    const inside = texts
      .filter((t) => t.at.x > r.x && t.at.x < r.x + r.w && t.at.y > r.y && t.at.y < r.y + r.h)
      .sort((a, b) => b.height - a.height);
    return inside[0]?.value ?? null;
  });

  // 3. Rapatkan celah tebal dinding, geser ke titik 0,0, lalu bulatkan ke grid
  rects = closeWallGaps(rects, wallTolerance);
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const used = new Set();
  const rooms = rects.map((r, i) => {
    const x = snapToGrid(r.x - minX);
    const y = snapToGrid(r.y - minY);
    const w = Math.max(MIN_ROOM_SIDE, snapToGrid(r.x + r.w - minX) - x);
    const h = Math.max(MIN_ROOM_SIDE, snapToGrid(r.y + r.h - minY) - y);
    // Nama unik (tidak peka huruf besar/kecil), ruangan tanpa teks diberi nomor
    let nama = (names[i] ?? `Ruang ${i + 1}`).slice(0, 60);
    let n = 2;
    while (used.has(nama.toLowerCase())) nama = `${names[i] ?? 'Ruang'} (${n++})`.slice(0, 60);
    used.add(nama.toLowerCase());
    return { nama, x, y, w, h, approximated: r.approximated };
  });

  const approximated = rooms.filter((r) => r.approximated).length;
  if (approximated > 0) {
    warnings.push(`${approximated} ruangan bukan kotak dan didekati dengan kotak pembatasnya.`);
  }
  const overlapping = rooms.filter((r, i) =>
    rooms.some((o, j) => j !== i && rectsOverlap({ ...r, id: i }, { ...o, id: j })),
  ).length;
  if (overlapping > 0) {
    warnings.push(
      `${overlapping} ruangan bertumpuk setelah dibulatkan ke grid ${GRID} m; yang bertumpuk akan dilewati.`,
    );
  }

  // 4. Pintu dari busur: engsel di pusat busur, ujung busur yang menempel dinding = sisi bebas
  const doors = [];
  if (doorLayer) {
    const shift = (p) => ({ x: p.x - minX, y: p.y - minY });
    const withFloor = rooms.map((r) => ({ ...r, lantai_id: 0 }));
    for (const arc of entities.filter((e) => e.layer === doorLayer && e.type === 'ARC')) {
      const hinge = shift(toPlan(arc.center));
      const r = arc.radius * scale;
      const ends = [arc.startAngle, arc.endAngle].map((angle) =>
        shift(
          toPlan({
            x: arc.center.x + Math.cos(angle) * arc.radius,
            y: arc.center.y + Math.sin(angle) * arc.radius,
          }),
        ),
      );
      let best = null;
      for (let i = 0; i < withFloor.length; i += 1) {
        for (let j = i + 1; j < withFloor.length; j += 1) {
          const wall = sharedWall(withFloor[i], withFloor[j]);
          if (!wall) continue;
          const across = (p) => Math.abs((wall.orientation === 'v' ? p.x : p.y) - wall.coord);
          const along = (p) => (wall.orientation === 'v' ? p.y : p.x);
          const distance = across(hinge);
          const inSpan = along(hinge) > wall.start - 0.3 && along(hinge) < wall.end + 0.3;
          if (distance > wallTolerance || !inSpan) continue;
          // Ujung busur yang paling dekat dengan garis dinding adalah ujung celah pintu
          const free = ends.sort((p, q) => across(p) - across(q))[0];
          const center = (along(hinge) + along(free)) / 2;
          if (!best || distance < best.distance) {
            best = { a: i, b: j, offset: center - wall.start, width: r, distance };
          }
        }
      }
      if (!best) continue;
      const duplicate = doors.some(
        (d) => d.a === best.a && d.b === best.b && Math.abs(d.offset - best.offset) < 0.5,
      );
      if (!duplicate)
        doors.push({ a: best.a, b: best.b, offset: Math.round(best.offset * 100) / 100 });
    }
  }

  return { rooms, doors, warnings };
}
