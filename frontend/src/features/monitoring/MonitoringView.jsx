import { useMemo, useState } from 'react';
import { Building2, RotateCcw, Search } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/Field';
import { useConfirm, useToast } from '../../components/ui/feedbackContext';
import {
  STATUS_META,
  STATUS_ORDER,
  getOccupancyStatus,
  summarizeRooms,
} from '../../domain/occupancy';
import { resetAllOccupancy } from '../../services/roomService';
import RoomCard from './RoomCard';
import StatsPanel from './StatsPanel';

export default function MonitoringView({ rooms, connections, onNavigate }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('semua');
  const [resetting, setResetting] = useState(false);

  const summary = useMemo(() => summarizeRooms(rooms), [rooms]);

  const visibleRooms = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rooms.filter(
      (room) =>
        room.nama_ruangan.toLowerCase().includes(keyword) &&
        (statusFilter === 'semua' || getOccupancyStatus(room) === statusFilter),
    );
  }, [rooms, search, statusFilter]);

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Kosongkan semua ruangan?',
      message: 'Jumlah orang di setiap ruangan akan diatur ke 0.',
      confirmLabel: 'Kosongkan semua',
      danger: true,
    });
    if (!ok) return;
    setResetting(true);
    try {
      await resetAllOccupancy(rooms);
      toast.success('Semua ruangan dikosongkan.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setResetting(false);
    }
  };

  if (rooms.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Building2}
          title="Belum ada ruangan"
          description="Tambahkan ruangan di menu Manajemen untuk mulai memantau occupancy."
          action={<Button onClick={() => onNavigate('management')}>Tambah ruangan</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <StatsPanel summary={summary} connectionCount={connections.length} />

      <Card>
        <CardHeader
          title="Status ruangan"
          description="Perubahan dari perangkat lain tampil otomatis."
          action={
            <Button
              variant="secondary"
              size="sm"
              icon={RotateCcw}
              loading={resetting}
              disabled={summary.totalOccupancy === 0}
              onClick={handleReset}
            >
              Kosongkan semua
            </Button>
          }
        />
        <CardBody>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <Input
                type="search"
                placeholder="Cari ruangan…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Cari ruangan"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="sm:w-48"
              aria-label="Filter status"
            >
              <option value="semua">Semua status</option>
              {STATUS_ORDER.map((key) => (
                <option key={key} value={key}>
                  {STATUS_META[key].label} ({STATUS_META[key].range})
                </option>
              ))}
            </Select>
          </div>

          {visibleRooms.length === 0 ? (
            <EmptyState icon={Search} title="Tidak ada ruangan yang cocok" />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleRooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
