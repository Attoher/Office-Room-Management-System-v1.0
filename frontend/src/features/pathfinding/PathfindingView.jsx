import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, Download, Navigation, Route, X, ZoomIn, ZoomOut } from 'lucide-react';
import FloorPlanCanvas from '../../components/floorplan/FloorPlanCanvas';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { Field, Select } from '../../components/ui/Field';
import { planBounds, routeSegmentsByFloor } from '../../domain/geometry';
import { planRoute } from '../../domain/pathfinding';
import FloorTabs from '../management/FloorTabs';
import RouteResult from './RouteResult';

const ZOOM_STEPS = [1, 1.5, 2, 3];

// Pilihan asal/tujuan disimpan di URL (?asal=ID&tujuan=ID) supaya jalur bisa dibagikan
function readRouteParam(name) {
  const value = Number(new URLSearchParams(window.location.search).get(name));
  return Number.isInteger(value) && value > 0 ? value : null;
}
const PX_PER_METER = 40;

function exportSvgAsPng(svg, box, filename) {
  const source = new XMLSerializer().serializeToString(svg);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = box.w * PX_PER_METER;
    canvas.height = box.h * PX_PER_METER;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
}

export default function PathfindingView({ floors, rooms, roomsById, doors, onNavigate }) {
  const svgRef = useRef(null);
  const [startId, setStartId] = useState(() => readRouteParam('asal'));
  const [targetId, setTargetId] = useState(() => readRouteParam('tujuan'));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [floorChoice, setFloorChoice] = useState(
    () => roomsById.get(readRouteParam('asal'))?.lantai_id ?? null,
  );
  const [zoomIndex, setZoomIndex] = useState(0);

  const floorId = floors.some((f) => f.id === floorChoice) ? floorChoice : (floors[0]?.id ?? null);
  const floorNames = useMemo(() => new Map(floors.map((f) => [f.id, f.nama])), [floors]);
  const floorName = (id) => floorNames.get(id) ?? '?';

  // Dihitung ulang otomatis saat occupancy/pintu berubah, jadi hasilnya selalu terkini
  const plan = useMemo(() => {
    if (!roomsById.has(startId) || !roomsById.has(targetId)) return null;
    return planRoute(rooms, doors, startId, targetId);
  }, [rooms, roomsById, doors, startId, targetId]);

  // Jumlah jalur bisa berkurang saat data berubah; kembali ke rekomendasi bila pilihan hilang
  const routeIndex = plan && selectedIndex < plan.routes.length ? selectedIndex : 0;
  const route = plan?.routes[routeIndex] ?? null;
  const segments = useMemo(
    () => (route ? routeSegmentsByFloor(route.roomIds, roomsById, doors) : new Map()),
    [route, roomsById, doors],
  );

  // Label "↕ Lantai 2" pada tangga/lift yang terhubung ke lantai lain
  const verticalLabels = useMemo(() => {
    const labels = new Map();
    for (const door of doors) {
      const a = roomsById.get(door.room_from);
      const b = roomsById.get(door.room_to);
      if (a.lantai_id === b.lantai_id) continue;
      labels.set(a.id, [...(labels.get(a.id) ?? []), floorNames.get(b.lantai_id)]);
      labels.set(b.id, [...(labels.get(b.id) ?? []), floorNames.get(a.lantai_id)]);
    }
    return new Map([...labels].map(([id, names]) => [id, `↕ ${names.join(', ')}`]));
  }, [doors, roomsById, floorNames]);

  const floorRooms = rooms.filter((room) => room.lantai_id === floorId);
  const box = planBounds(floorRooms, 1.5);
  const routeFloors = [...segments.keys()];

  useEffect(() => {
    const params = new URLSearchParams();
    if (startId) params.set('asal', startId);
    if (targetId) params.set('tujuan', targetId);
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [startId, targetId]);

  const chooseStart = (id) => {
    setStartId(id);
    setSelectedIndex(0);
    if (id) setFloorChoice(roomsById.get(id).lantai_id);
  };
  const chooseTarget = (id) => {
    setTargetId(id);
    setSelectedIndex(0);
  };

  // Klik di denah: isi asal dulu, lalu tujuan; klik berikutnya mengganti tujuan
  const handleRoomClick = (_event, room) => {
    if (!startId || room.id === startId) chooseStart(room.id);
    else chooseTarget(room.id);
  };

  const swap = () => {
    setStartId(targetId);
    setTargetId(startId);
    setSelectedIndex(0);
  };

  const reset = () => {
    setStartId(null);
    setTargetId(null);
    setSelectedIndex(0);
  };

  if (rooms.length < 2 || doors.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Route}
          title="Belum bisa mencari jalur"
          description="Butuh minimal 2 ruangan yang tersambung lewat pintu."
          action={<Button onClick={() => onNavigate('management')}>Buka editor denah</Button>}
        />
      </Card>
    );
  }

  const roomOptions = (excludeId) =>
    floors.map((floor) => (
      <optgroup key={floor.id} label={floor.nama}>
        {rooms
          .filter((room) => room.lantai_id === floor.id && room.id !== excludeId)
          .map((room) => (
            <option key={room.id} value={room.id}>
              {room.nama_ruangan} ({room.occupancy}/{room.kapasitas_max})
            </option>
          ))}
      </optgroup>
    ));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      <Card className="h-fit xl:col-span-2">
        <CardHeader
          title="Cek jalur tamu"
          description="Jalur terpendek (meter) lewat pintu, menghindari ruangan penuh."
        />
        <CardBody className="space-y-5">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-3">
              <Field label="Ruangan asal">
                {(id) => (
                  <Select
                    id={id}
                    value={startId ?? ''}
                    onChange={(e) => chooseStart(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Pilih ruangan asal</option>
                    {roomOptions(targetId)}
                  </Select>
                )}
              </Field>
              <Field label="Ruangan tujuan">
                {(id) => (
                  <Select
                    id={id}
                    value={targetId ?? ''}
                    onChange={(e) => chooseTarget(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Pilih ruangan tujuan</option>
                    {roomOptions(startId)}
                  </Select>
                )}
              </Field>
            </div>
            <div className="flex flex-col gap-1 pb-0.5">
              <Button
                variant="ghost"
                size="icon"
                icon={ArrowDownUp}
                onClick={swap}
                disabled={!startId && !targetId}
                aria-label="Tukar asal dan tujuan"
              />
              <Button
                variant="ghost"
                size="icon"
                icon={X}
                onClick={reset}
                disabled={!startId && !targetId}
                aria-label="Reset pilihan"
              />
            </div>
          </div>

          {plan ? (
            <RouteResult
              plan={plan}
              roomsById={roomsById}
              floors={floors}
              selectedIndex={routeIndex}
              onSelect={setSelectedIndex}
            />
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
              <Navigation className="size-4 shrink-0" aria-hidden />
              Pilih ruangan asal dan tujuan, atau klik langsung di denah.
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="xl:col-span-3">
        <CardHeader
          title="Denah"
          description={
            routeFloors.length > 1
              ? `Jalur melewati ${routeFloors.map(floorName).join(' → ')}`
              : undefined
          }
          action={
            floors.length > 1 && (
              <FloorTabs
                floors={floors}
                rooms={rooms}
                floorId={floorId}
                onSelect={setFloorChoice}
              />
            )
          }
        />
        <CardBody>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              <li className="flex items-center gap-1.5">
                <span
                  className="size-3 rounded-sm border-2 border-blue-600 bg-blue-100"
                  aria-hidden
                />
                Asal
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  className="size-3 rounded-sm border-2 border-slate-900 bg-slate-200"
                  aria-hidden
                />
                Tujuan
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1 w-4 rounded bg-blue-600" aria-hidden /> Jalur tamu
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  className="size-3 rounded-sm bg-emerald-100 ring-1 ring-slate-400"
                  aria-hidden
                />
                <span
                  className="size-3 rounded-sm bg-yellow-100 ring-1 ring-slate-400"
                  aria-hidden
                />
                <span className="size-3 rounded-sm bg-red-100 ring-1 ring-slate-400" aria-hidden />
                Status isi
              </li>
            </ul>
            <div className="flex gap-1">
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
              <Button
                variant="ghost"
                size="icon"
                icon={Download}
                onClick={() =>
                  exportSvgAsPng(
                    svgRef.current,
                    box,
                    `denah-${floorName(floorId).toLowerCase().replace(/\s+/g, '-')}.png`,
                  )
                }
                aria-label="Unduh PNG"
              />
            </div>
          </div>
          <div className="h-[440px] overflow-auto rounded-lg bg-white ring-1 ring-inset ring-slate-200 sm:h-[540px]">
            <FloorPlanCanvas
              ref={svgRef}
              rooms={floorRooms}
              doors={doors}
              roomsById={roomsById}
              box={box}
              zoom={ZOOM_STEPS[zoomIndex]}
              startId={startId}
              targetId={targetId}
              routeSegments={segments.get(floorId) ?? []}
              verticalLabels={verticalLabels}
              onRoomPointerDown={handleRoomClick}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Klik ruangan untuk memilih asal lalu tujuan. Jalur lintas lantai melewati tangga atau
            lift yang ditandai ↕.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
