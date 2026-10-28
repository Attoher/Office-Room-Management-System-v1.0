import { useMemo, useState } from 'react';
import { ArrowLeftRight, Link2, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { Field, Select } from '../../components/ui/Field';
import { useConfirm, useToast } from '../../components/ui/feedbackContext';
import { connectionId, createConnection, deleteConnection } from '../../services/connectionService';

export default function ConnectionsSection({ rooms, connections }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [roomA, setRoomA] = useState('');
  const [roomB, setRoomB] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const existingIds = useMemo(() => new Set(connections.map((c) => c.id)), [connections]);
  const a = Number(roomA);
  const b = Number(roomB);
  const alreadyLinked = Boolean(a && b && existingIds.has(connectionId(a, b)));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createConnection(a, b);
      toast.success('Koneksi ditambahkan.');
      setRoomB('');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (connection) => {
    const ok = await confirm({
      title: 'Hapus koneksi?',
      message: `${connection.from_name} ↔ ${connection.to_name} tidak lagi terhubung.`,
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteConnection(connection.id);
      toast.success('Koneksi dihapus.');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const roomOptions = (excludeId) =>
    rooms
      .filter((room) => room.id !== excludeId)
      .map((room) => (
        <option key={room.id} value={room.id}>
          {room.nama_ruangan}
        </option>
      ));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <Card className="h-fit lg:col-span-2">
        <CardHeader
          title="Hubungkan ruangan"
          description="Koneksi berlaku dua arah untuk pencarian jalur."
        />
        <CardBody>
          {rooms.length < 2 ? (
            <p className="text-sm text-slate-500">Butuh minimal 2 ruangan untuk membuat koneksi.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Ruangan pertama">
                {(id) => (
                  <Select id={id} value={roomA} onChange={(e) => setRoomA(e.target.value)}>
                    <option value="">Pilih ruangan</option>
                    {roomOptions(b)}
                  </Select>
                )}
              </Field>
              <Field
                label="Ruangan kedua"
                error={alreadyLinked ? 'Kedua ruangan ini sudah terhubung' : undefined}
              >
                {(id) => (
                  <Select
                    id={id}
                    value={roomB}
                    onChange={(e) => setRoomB(e.target.value)}
                    error={alreadyLinked}
                  >
                    <option value="">Pilih ruangan</option>
                    {roomOptions(a)}
                  </Select>
                )}
              </Field>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  icon={Link2}
                  loading={submitting}
                  disabled={!a || !b || alreadyLinked}
                >
                  Hubungkan
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader title="Daftar koneksi" description={`${connections.length} koneksi`} />
        {connections.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="Belum ada koneksi"
            description="Hubungkan ruangan agar jalur tamu bisa dicari."
          />
        ) : (
          <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
            {connections.map((connection) => (
              <li key={connection.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium text-slate-900">
                  {connection.from_name}
                </span>
                <ArrowLeftRight className="size-4 shrink-0 text-slate-400" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-900">
                  {connection.to_name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  icon={Trash2}
                  onClick={() => handleDelete(connection)}
                  className="hover:bg-red-50 hover:text-red-600"
                  aria-label={`Hapus koneksi ${connection.from_name} dan ${connection.to_name}`}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
