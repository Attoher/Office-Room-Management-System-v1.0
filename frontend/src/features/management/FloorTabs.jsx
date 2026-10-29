import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import Modal from '../../components/ui/Modal';
import { useConfirm, useToast } from '../../components/ui/feedbackContext';
import { createFloor, deleteFloor, renameFloor } from '../../services/floorService';

/** Pilihan lantai + tambah/ganti nama/hapus lantai. */
export default function FloorTabs({
  floors,
  rooms,
  floorId,
  officeId,
  onSelect,
  editable = false,
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [dialog, setDialog] = useState(null); // { mode: 'create' | 'rename', nama }
  const [saving, setSaving] = useState(false);
  const current = floors.find((floor) => floor.id === floorId);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (dialog.mode === 'create') {
        const id = await createFloor(dialog.nama, officeId);
        onSelect(id);
        toast.success(`${dialog.nama.trim()} ditambahkan.`);
      } else {
        await renameFloor(floorId, dialog.nama);
      }
      setDialog(null);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Hapus ${current.nama}?`,
      message: 'Lantai yang sudah kosong akan dihapus.',
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteFloor(current, rooms);
      onSelect(floors.find((floor) => floor.id !== floorId)?.id ?? null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Lantai">
        {floors.map((floor) => (
          <button
            key={floor.id}
            type="button"
            role="tab"
            aria-selected={floor.id === floorId}
            onClick={() => onSelect(floor.id)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              floor.id === floorId
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {floor.nama}
          </button>
        ))}
      </div>
      {editable && (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={Plus}
            onClick={() => setDialog({ mode: 'create', nama: `Lantai ${floors.length + 1}` })}
          >
            Lantai
          </Button>
          {current && (
            <>
              <Button
                variant="ghost"
                size="icon"
                icon={Pencil}
                onClick={() => setDialog({ mode: 'rename', nama: current.nama })}
                aria-label={`Ganti nama ${current.nama}`}
              />
              <Button
                variant="ghost"
                size="icon"
                icon={Trash2}
                onClick={handleDelete}
                className="hover:bg-red-50 hover:text-red-600"
                aria-label={`Hapus ${current.nama}`}
              />
            </>
          )}
        </div>
      )}

      <Modal
        open={Boolean(dialog)}
        size="sm"
        title={dialog?.mode === 'create' ? 'Tambah lantai' : 'Ganti nama lantai'}
        onClose={() => setDialog(null)}
      >
        {dialog && (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Nama lantai">
              {(id) => (
                <Input
                  id={id}
                  value={dialog.nama}
                  maxLength={40}
                  onChange={(e) => setDialog({ ...dialog, nama: e.target.value })}
                />
              )}
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDialog(null)}>
                Batal
              </Button>
              <Button type="submit" loading={saving}>
                Simpan
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
