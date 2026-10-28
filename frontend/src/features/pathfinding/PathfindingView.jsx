import { useMemo, useState } from 'react';
import { ArrowDownUp, Navigation, Route, X } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { Field, Select } from '../../components/ui/Field';
import { planRoute } from '../../domain/pathfinding';
import GraphView from './GraphView';
import RouteResult from './RouteResult';

export default function PathfindingView({ rooms, roomsById, connections, onNavigate }) {
  const [startId, setStartId] = useState(null);
  const [targetId, setTargetId] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Dihitung ulang otomatis saat occupancy/koneksi berubah, jadi hasilnya selalu terkini
  const plan = useMemo(() => {
    if (!startId || !targetId || !roomsById.has(startId) || !roomsById.has(targetId)) return null;
    return planRoute(rooms, connections, startId, targetId);
  }, [rooms, roomsById, connections, startId, targetId]);

  // Jumlah jalur bisa berkurang saat data berubah; kembali ke rekomendasi bila pilihan hilang
  const routeIndex = plan && selectedIndex < plan.routes.length ? selectedIndex : 0;
  const selectedRoute = plan?.routes[routeIndex] ?? null;

  const choose = (setter) => (value) => {
    setter(value ? Number(value) : null);
    setSelectedIndex(0);
  };
  const chooseStart = choose(setStartId);
  const chooseTarget = choose(setTargetId);

  // Klik di graph: isi asal dulu, lalu tujuan; klik berikutnya mengganti tujuan
  const handleRoomClick = (roomId) => {
    if (!startId || roomId === startId) chooseStart(roomId);
    else chooseTarget(roomId);
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

  if (rooms.length < 2 || connections.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Route}
          title="Belum bisa mencari jalur"
          description="Butuh minimal 2 ruangan yang saling terhubung."
          action={<Button onClick={() => onNavigate('management')}>Buka manajemen</Button>}
        />
      </Card>
    );
  }

  const roomOptions = (excludeId) =>
    rooms
      .filter((room) => room.id !== excludeId)
      .map((room) => (
        <option key={room.id} value={room.id}>
          {room.nama_ruangan} ({room.occupancy}/{room.kapasitas_max})
        </option>
      ));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      <Card className="h-fit xl:col-span-2">
        <CardHeader
          title="Cek jalur tamu"
          description="Mencari jalur terpendek yang menghindari ruangan penuh."
        />
        <CardBody className="space-y-5">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-3">
              <Field label="Ruangan asal">
                {(id) => (
                  <Select
                    id={id}
                    value={startId ?? ''}
                    onChange={(e) => chooseStart(e.target.value)}
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
                    onChange={(e) => chooseTarget(e.target.value)}
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
              selectedIndex={routeIndex}
              onSelect={setSelectedIndex}
            />
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
              <Navigation className="size-4 shrink-0" aria-hidden />
              Pilih ruangan asal dan tujuan, atau klik langsung di graph.
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="xl:col-span-3">
        <CardHeader title="Peta koneksi ruangan" />
        <CardBody>
          <GraphView
            rooms={rooms}
            connections={connections}
            startId={startId}
            targetId={targetId}
            route={selectedRoute}
            onRoomClick={handleRoomClick}
          />
        </CardBody>
      </Card>
    </div>
  );
}
