import { useMemo, useState } from 'react';
import { AlertTriangle, FileDown, FileUp } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/feedbackContext';
import { floorToDxf } from '../../domain/dxf/exportDxf';
import { analyzeDxf, extractPlan } from '../../domain/dxf/importDxf';
import { geometryError, planBounds } from '../../domain/geometry';
import { toNameKey } from '../../domain/roomValidation';
import { createDoor } from '../../services/doorService';
import { createFloor } from '../../services/floorService';
import { createRoom } from '../../services/roomService';

const SQM_PER_PERSON = 4; // perkiraan kapasitas awal ruangan hasil import

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/dxf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Tombol export & import DXF (AutoCAD) untuk editor denah. */
export default function DxfTools({ floor, floors, rooms, roomsById, doors, elements, onImported }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const exportFloor = () => {
    const text = floorToDxf({ floorId: floor.id, rooms, doors, elements, roomsById });
    download(`denah-${slug(floor.nama)}.dxf`, text);
    toast.success(`${floor.nama} diexport ke DXF.`);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={FileDown}
        onClick={exportFloor}
        disabled={!floor || !rooms.some((r) => r.lantai_id === floor.id)}
        title="Unduh denah lantai ini sebagai DXF untuk AutoCAD"
      >
        Export DXF
      </Button>
      <Button
        variant="ghost"
        size="sm"
        icon={FileUp}
        onClick={() => setOpen(true)}
        title="Import denah dari file DXF AutoCAD ke lantai baru"
      >
        Import DXF
      </Button>
      {open && (
        <ImportDialog
          floors={floors}
          rooms={rooms}
          onClose={() => setOpen(false)}
          onImported={(id) => {
            setOpen(false);
            onImported(id);
          }}
        />
      )}
    </>
  );
}

function ImportDialog({ floors, rooms, onClose, onImported }) {
  const toast = useToast();
  const [file, setFile] = useState(null); // { name, dxf, analysis }
  const [options, setOptions] = useState(null);
  const [floorName, setFloorName] = useState('');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  const handleFile = async (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setError('');
    try {
      // Parser cukup besar, jadi baru dimuat saat dibutuhkan
      const { default: DxfParser } = await import('dxf-parser');
      const dxf = new DxfParser().parseSync(await selected.text());
      const analysis = analyzeDxf(dxf);
      setFile({ name: selected.name, dxf, analysis });
      setOptions({ ...analysis.guess, unit: analysis.unit, wallTolerance: 0.3 });
      setFloorName(`Import ${selected.name.replace(/\.dxf$/i, '')}`.slice(0, 40));
    } catch (e) {
      console.error(e);
      setError(
        'File tidak bisa dibaca sebagai DXF. Di AutoCAD gunakan File → Save As → AutoCAD DXF (*.dxf).',
      );
    }
  };

  const plan = useMemo(
    () => (file && options?.roomLayer ? extractPlan(file.dxf, options) : null),
    [file, options],
  );

  const startImport = async () => {
    setProgress({ done: 0, total: plan.rooms.length });
    try {
      const lantai_id = await createFloor(floorName || `Lantai ${floors.length + 1}`);
      const existingNames = new Set(rooms.map((r) => toNameKey(r.nama_ruangan)));
      const created = [];
      const skipped = [];
      const indexToRoom = new Map();

      for (const [index, item] of plan.rooms.entries()) {
        const rect = { lantai_id, x: item.x, y: item.y, w: item.w, h: item.h };
        // Nama yang sudah dipakai di lantai lain diberi akhiran agar tetap unik
        let nama = item.nama;
        for (let n = 2; existingNames.has(toNameKey(nama)); n += 1) {
          nama = `${item.nama} (${n})`.slice(0, 60);
        }
        const clash = geometryError({ ...rect, id: -1 }, created);
        if (clash) {
          skipped.push(`${item.nama}: ${clash}`);
        } else {
          try {
            const kapasitas_max = Math.max(1, Math.round((item.w * item.h) / SQM_PER_PERSON));
            const id = await createRoom(
              { nama_ruangan: nama, tipe: 'ruangan', kapasitas_max },
              rect,
              created,
            );
            const room = {
              id,
              nama_ruangan: nama,
              tipe: 'ruangan',
              kapasitas_max,
              occupancy: 0,
              ...rect,
            };
            created.push(room);
            indexToRoom.set(index, room);
            existingNames.add(toNameKey(nama));
          } catch (e) {
            skipped.push(`${item.nama}: ${e.message}`);
          }
        }
        setProgress({ done: index + 1, total: plan.rooms.length });
      }

      const createdById = new Map(created.map((r) => [r.id, r]));
      const createdDoors = [];
      for (const d of plan.doors) {
        const a = indexToRoom.get(d.a);
        const b = indexToRoom.get(d.b);
        if (!a || !b) continue;
        try {
          createdDoors.push(await createDoor(a, b, createdDoors, createdById));
        } catch {
          // pintu yang tidak muat dilewati; bisa ditambahkan manual di editor
        }
      }

      toast.success(
        `${created.length} ruangan dan ${createdDoors.length} pintu diimport${skipped.length ? `, ${skipped.length} dilewati` : ''}.`,
      );
      if (skipped.length) console.warn('Ruangan dilewati saat import:', skipped);
      onImported(lantai_id);
    } catch (e) {
      setProgress(null);
      setError(e.message);
    }
  };

  const layerOptions = (field) => (
    <>
      {field === 'doorLayer' && <option value="">(tanpa pintu)</option>}
      {file.analysis.layers.map((layer) => (
        <option key={layer.name} value={layer.name}>
          {layer.name} · {layer.polylines} bidang, {layer.texts} teks, {layer.arcs} busur
        </option>
      ))}
    </>
  );

  const set = (key) => (e) => setOptions((o) => ({ ...o, [key]: e.target.value }));
  const box = plan?.rooms.length ? planBounds(plan.rooms, 1) : null;

  return (
    <Modal open title="Import denah dari DXF" onClose={progress ? () => {} : onClose} size="lg">
      <div className="space-y-4">
        {!file && (
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              Simpan denah di AutoCAD lewat <strong>File → Save As → AutoCAD DXF</strong>, lalu
              pilih filenya. Ruangan dibaca dari polyline tertutup, nama dari teks di dalamnya, dan
              pintu dari busur ayunan daun pintu.
            </p>
            <input
              type="file"
              accept=".dxf"
              onChange={handleFile}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500"
            />
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        )}

        {file && options && (
          <>
            <p className="text-sm text-slate-600">
              <strong>{file.name}</strong> · {file.analysis.layers.length} layer
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Layer ruangan (polyline tertutup)">
                {(id) => (
                  <Select id={id} value={options.roomLayer} onChange={set('roomLayer')}>
                    {layerOptions('roomLayer')}
                  </Select>
                )}
              </Field>
              <Field label="Layer nama ruangan (teks)">
                {(id) => (
                  <Select id={id} value={options.textLayer} onChange={set('textLayer')}>
                    {layerOptions('textLayer')}
                  </Select>
                )}
              </Field>
              <Field label="Layer pintu (busur)">
                {(id) => (
                  <Select id={id} value={options.doorLayer} onChange={set('doorLayer')}>
                    {layerOptions('doorLayer')}
                  </Select>
                )}
              </Field>
              <Field label="Satuan gambar">
                {(id) => (
                  <Select id={id} value={options.unit} onChange={set('unit')}>
                    <option value="mm">Milimeter</option>
                    <option value="cm">Sentimeter</option>
                    <option value="m">Meter</option>
                  </Select>
                )}
              </Field>
              <Field
                label="Tebal dinding maksimal (m)"
                hint="Celah antar ruangan setipis ini dirapatkan agar dikenali bersebelahan."
              >
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={options.wallTolerance}
                    onChange={(e) =>
                      setOptions((o) => ({ ...o, wallTolerance: Number(e.target.value) }))
                    }
                  />
                )}
              </Field>
              <Field label="Nama lantai baru">
                {(id) => (
                  <Input
                    id={id}
                    value={floorName}
                    maxLength={40}
                    onChange={(e) => setFloorName(e.target.value)}
                  />
                )}
              </Field>
            </div>

            {plan && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  Pratinjau: {plan.rooms.length} ruangan, {plan.doors.length} pintu
                </p>
                {plan.warnings.map((warning) => (
                  <p
                    key={warning}
                    className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {warning}
                  </p>
                ))}
                {box && (
                  <div className="h-64 overflow-hidden rounded-lg bg-slate-50 ring-1 ring-inset ring-slate-200">
                    <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="size-full">
                      {plan.rooms.map((r) => (
                        <g key={r.nama}>
                          <rect
                            x={r.x}
                            y={r.y}
                            width={r.w}
                            height={r.h}
                            fill={r.approximated ? '#fef3c7' : '#ecfdf5'}
                            stroke="#334155"
                            strokeWidth={Math.max(box.w, box.h) / 400}
                          />
                          <text
                            x={r.x + r.w / 2}
                            y={r.y + r.h / 2}
                            textAnchor="middle"
                            fontSize={Math.min(r.w / 8, Math.max(box.w, box.h) / 40)}
                            fill="#0f172a"
                          >
                            {r.nama}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              {progress && (
                <span className="mr-auto text-sm text-slate-500">
                  Mengimport {progress.done}/{progress.total}…
                </span>
              )}
              <Button variant="secondary" onClick={onClose} disabled={Boolean(progress)}>
                Batal
              </Button>
              <Button
                onClick={startImport}
                loading={Boolean(progress)}
                disabled={!plan?.rooms.length}
              >
                Import ke lantai baru
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
