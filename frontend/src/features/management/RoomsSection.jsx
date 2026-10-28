import { useState } from 'react';
import { Building2, Pencil, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useConfirm, useToast } from '../../components/ui/feedbackContext';
import { createRoom, deleteRoom, updateRoom } from '../../services/roomService';
import RoomForm from './RoomForm';

export default function RoomsSection({ rooms, connections }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [editingRoom, setEditingRoom] = useState(null);

  const handleCreate = async (values) => {
    await createRoom(values);
    toast.success(`Ruangan "${values.nama_ruangan.trim()}" ditambahkan.`);
  };

  const handleUpdate = async (values) => {
    await updateRoom(editingRoom, values);
    toast.success('Perubahan disimpan.');
    setEditingRoom(null);
  };

  const handleDelete = async (room) => {
    const linked = connections.filter(
      (c) => c.room_from === room.id || c.room_to === room.id,
    ).length;
    const ok = await confirm({
      title: `Hapus "${room.nama_ruangan}"?`,
      message:
        linked > 0
          ? `${linked} koneksi yang terhubung ke ruangan ini juga akan dihapus.`
          : 'Ruangan ini akan dihapus permanen.',
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteRoom(room.id);
      toast.success(`Ruangan "${room.nama_ruangan}" dihapus.`);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <Card className="h-fit lg:col-span-2">
        <CardHeader title="Tambah ruangan" />
        <CardBody>
          <RoomForm submitLabel="Tambah ruangan" onSubmit={handleCreate} resetOnSuccess />
        </CardBody>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader title="Daftar ruangan" description={`${rooms.length} ruangan`} />
        {rooms.length === 0 ? (
          <EmptyState icon={Building2} title="Belum ada ruangan" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5">Nama</th>
                  <th className="px-3 py-2.5 text-right">Luas</th>
                  <th className="px-3 py-2.5 text-right">Isi</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-5 py-2.5">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-slate-50">
                    <td className="max-w-48 truncate px-5 py-3 font-medium text-slate-900">
                      {room.nama_ruangan}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-600">
                      {room.luas} m²
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-600">
                      {room.occupancy}/{room.kapasitas_max}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <StatusBadge room={room} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        icon={Pencil}
                        onClick={() => setEditingRoom(room)}
                        aria-label={`Edit ${room.nama_ruangan}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        icon={Trash2}
                        onClick={() => handleDelete(room)}
                        className="hover:bg-red-50 hover:text-red-600"
                        aria-label={`Hapus ${room.nama_ruangan}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(editingRoom)}
        title={`Edit ${editingRoom?.nama_ruangan ?? ''}`}
        onClose={() => setEditingRoom(null)}
      >
        {editingRoom && (
          <RoomForm
            key={editingRoom.id}
            initialValues={{
              nama_ruangan: editingRoom.nama_ruangan,
              luas: String(editingRoom.luas),
              kapasitas_max: String(editingRoom.kapasitas_max),
            }}
            currentOccupancy={editingRoom.occupancy}
            submitLabel="Simpan"
            onSubmit={handleUpdate}
            onCancel={() => setEditingRoom(null)}
          />
        )}
      </Modal>
    </div>
  );
}
