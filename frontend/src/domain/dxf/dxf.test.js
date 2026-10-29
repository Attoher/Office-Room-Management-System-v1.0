import DxfParser from 'dxf-parser';
import { describe, expect, it } from 'vitest';
import { floorToDxf } from './exportDxf';
import { analyzeDxf, cleanMText, extractPlan } from './importDxf';

const parse = (text) => new DxfParser().parseSync(text);

const room = (id, nama, x, y, w, h, extra = {}) => ({
  id,
  nama_ruangan: nama,
  lantai_id: 1,
  tipe: 'ruangan',
  x,
  y,
  w,
  h,
  luas: w * h,
  occupancy: 0,
  kapasitas_max: 10,
  ...extra,
});

describe('export lalu import DXF (round-trip)', () => {
  const rooms = [
    room(1, 'Lobby', 0, 0, 8, 6),
    room(2, 'Lorong', 8, 4, 10, 2, { tipe: 'lorong' }),
    room(3, 'Ruang Rapat', 8, 0, 6, 4),
  ];
  const roomsById = new Map(rooms.map((r) => [r.id, r]));
  const doors = [
    { id: 'd1', room_from: 1, room_to: 2, offset: 1, swing_into: 2, hinge: 'start' },
    { id: 'd2', room_from: 2, room_to: 3, offset: 3, swing_into: 3, hinge: 'end' },
  ];
  const elements = [
    { id: 'k', jenis: 'kolom', lantai_id: 1, x: 7.8, y: 5.8, w: 0.4, h: 0.4 },
    {
      id: 'f',
      jenis: 'furnitur',
      lantai_id: 1,
      room_id: 3,
      model: 'meja_rapat_6',
      x: 1,
      y: 1,
      rotasi: 0,
    },
  ];
  const text = floorToDxf({ floorId: 1, rooms, doors, elements, roomsById });
  const dxf = parse(text);

  it('menghasilkan DXF yang bisa dibaca dengan layer terpisah', () => {
    const { layers, unit, guess } = analyzeDxf(dxf);
    expect(unit).toBe('mm');
    expect(layers.map((l) => l.name)).toEqual(
      expect.arrayContaining(['A-RUANG', 'A-PINTU', 'A-TEKS', 'A-KOLOM', 'A-FURNITUR']),
    );
    expect(guess).toMatchObject({
      roomLayer: 'A-RUANG',
      textLayer: 'A-TEKS',
      doorLayer: 'A-PINTU',
    });
  });

  it('ruangan, nama, dan pintu kembali sama', () => {
    const plan = extractPlan(dxf, {
      roomLayer: 'A-RUANG',
      textLayer: 'A-TEKS',
      doorLayer: 'A-PINTU',
      unit: 'mm',
    });
    const byName = Object.fromEntries(plan.rooms.map((r) => [r.nama, r]));
    expect(byName.Lobby).toMatchObject({ x: 0, y: 0, w: 8, h: 6, approximated: false });
    expect(byName['Ruang Rapat']).toMatchObject({ x: 8, y: 0, w: 6, h: 4 });
    expect(byName.Lorong).toMatchObject({ x: 8, y: 4, w: 10, h: 2 });

    const pairs = plan.doors.map((d) =>
      [plan.rooms[d.a].nama, plan.rooms[d.b].nama].sort().join('–'),
    );
    expect(pairs.sort()).toEqual(['Lobby–Lorong', 'Lorong–Ruang Rapat']);
    const lobbyDoor = plan.doors.find((d) => [d.a, d.b].includes(plan.rooms.indexOf(byName.Lobby)));
    expect(lobbyDoor.offset).toBeCloseTo(1, 1);
    expect(plan.warnings).toEqual([]);
  });
});

describe('import DXF bergaya AutoCAD', () => {
  // Dua ruangan dengan dinding setebal 150 mm di antaranya, LWPOLYLINE, MTEXT, dan
  // satu ruangan berbentuk L. Koordinat milimeter, y ke atas.
  const lw = (layer, points) =>
    [
      '0',
      'LWPOLYLINE',
      '8',
      layer,
      '90',
      String(points.length),
      '70',
      '1',
      ...points.flatMap(([x, y]) => ['10', String(x), '20', String(y)]),
    ].join('\n');
  const mtext = (layer, x, y, value) =>
    ['0', 'MTEXT', '8', layer, '10', String(x), '20', String(y), '40', '250', '1', value].join(
      '\n',
    );
  const arc = (layer, x, y, r, start, end) =>
    [
      '0',
      'ARC',
      '8',
      layer,
      '10',
      String(x),
      '20',
      String(y),
      '40',
      String(r),
      '50',
      String(start),
      '51',
      String(end),
    ].join('\n');
  const text = [
    '0',
    'SECTION',
    '2',
    'ENTITIES',
    lw('RUANG', [
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [0, 3000],
    ]),
    lw('RUANG', [
      [4150, 0],
      [8000, 0],
      [8000, 3000],
      [4150, 3000],
    ]),
    lw('RUANG', [
      [0, 3150],
      [3000, 3150],
      [3000, 5000],
      [6000, 5000],
      [6000, 7000],
      [0, 7000],
    ]),
    mtext('TEKS', 2000, 1500, '{\\fArial|b1;Ruang Kerja}'),
    mtext('TEKS', 6000, 1500, 'Ruang\\PDirektur'),
    // Pintu di dinding x = 4000..4150, engsel di y = 500, daun 900 mm membuka ke kanan
    arc('PINTU', 4150, 500, 900, 0, 90),
    '0',
    'ENDSEC',
    '0',
    'EOF',
  ].join('\n');
  const dxf = parse(text);

  it('menebak layer dan satuan', () => {
    expect(analyzeDxf(dxf)).toMatchObject({
      unit: 'mm',
      guess: { roomLayer: 'RUANG', textLayer: 'TEKS', doorLayer: 'PINTU' },
    });
  });

  it('merapatkan tebal dinding, membersihkan MTEXT, dan menandai ruangan non-kotak', () => {
    const plan = extractPlan(dxf, {
      roomLayer: 'RUANG',
      textLayer: 'TEKS',
      doorLayer: 'PINTU',
      unit: 'mm',
    });
    const [kerja, direktur, lShape] = plan.rooms;
    expect(kerja.nama).toBe('Ruang Kerja');
    expect(direktur.nama).toBe('Ruang Direktur');
    // Celah 150 mm dirapatkan sehingga kedua ruangan berbagi dinding
    expect(kerja.x + kerja.w).toBe(direktur.x);
    expect(lShape.approximated).toBe(true);
    expect(lShape.nama).toBe('Ruang 3');
    expect(plan.warnings[0]).toMatch(/bukan kotak/);
    expect(plan.doors).toHaveLength(1);
    expect(plan.doors[0]).toMatchObject({ a: 0, b: 1 });
  });

  it('cleanMText membuang kode format', () => {
    expect(cleanMText('{\\fArial|b1;Lobby}\\PUtama')).toBe('Lobby Utama');
  });
});
