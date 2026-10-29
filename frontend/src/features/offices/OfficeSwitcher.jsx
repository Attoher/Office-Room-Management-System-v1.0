import { useEffect, useRef, useState } from 'react';
import { Building, Check, ChevronDown, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useConfirm, useToast } from '../../components/ui/feedbackContext';
import { createOffice, deleteOffice, updateOffice } from '../../services/officeService';
import OfficeForm from './OfficeForm';

function summaryText(summary) {
  if (!summary) return '';
  return `${summary.floors} lantai · ${summary.rooms} ruangan · ${summary.occupancy}/${summary.capacity} orang`;
}

/** Pemilih kantor di header + dialog untuk menambah, mengubah, dan menghapus kantor. */
export default function OfficeSwitcher({ offices, floors, office, summaries, onSelect }) {
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const rootRef = useRef(null);

  // Tutup daftar saat klik di luar atau tekan Escape
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex max-w-48 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 sm:max-w-64"
      >
        <Building className="size-4 shrink-0 text-slate-500" aria-hidden />
        <span className="truncate">{office?.nama ?? 'Pilih kantor'}</span>
        <ChevronDown className="size-4 shrink-0 text-slate-400" aria-hidden />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200">
          <ul role="listbox" aria-label="Kantor" className="max-h-80 overflow-y-auto py-1">
            {offices.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={item.id === office?.id}
                  onClick={() => {
                    onSelect(item.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <Check
                    className={`mt-0.5 size-4 shrink-0 ${item.id === office?.id ? 'text-blue-600' : 'text-transparent'}`}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {item.nama}
                    </span>
                    {item.alamat && (
                      <span className="block truncate text-xs text-slate-500">{item.alamat}</span>
                    )}
                    <span className="block text-xs text-slate-400">
                      {summaryText(summaries.get(item.id))}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!offices.some((o) => o.virtual) && (
            <button
              type="button"
              onClick={() => {
                setManaging(true);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Settings className="size-4 text-slate-500" aria-hidden />
              Kelola kantor
            </button>
          )}
        </div>
      )}

      <Modal open={managing} title="Kelola kantor" size="lg" onClose={() => setManaging(false)}>
        <OfficeManager
          offices={offices}
          floors={floors}
          summaries={summaries}
          activeId={office?.id}
          onSelect={onSelect}
        />
      </Modal>
    </div>
  );
}

function OfficeManager({ offices, floors, summaries, activeId, onSelect }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null); // id kantor yang diedit, atau 'baru'

  const remove = async (item) => {
    const ok = await confirm({
      title: `Hapus ${item.nama}?`,
      message: 'Kantor yang sudah tidak punya lantai akan dihapus.',
      confirmLabel: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteOffice(item, floors);
      toast.success(`${item.nama} dihapus.`);
      if (item.id === activeId) onSelect(offices.find((o) => o.id !== item.id)?.id ?? null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
        {offices.map((item) =>
          editing === item.id ? (
            <li key={item.id} className="p-3">
              <OfficeForm
                initialValues={{ nama: item.nama, alamat: item.alamat }}
                submitLabel="Simpan"
                onCancel={() => setEditing(null)}
                onSubmit={async (values) => {
                  await updateOffice(item.id, values);
                  setEditing(null);
                }}
              />
            </li>
          ) : (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {item.nama}
                  {item.id === activeId && (
                    <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                      dibuka
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {[item.alamat, summaryText(summaries.get(item.id))].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                icon={Pencil}
                onClick={() => setEditing(item.id)}
                aria-label={`Ubah ${item.nama}`}
              />
              <Button
                variant="ghost"
                size="icon"
                icon={Trash2}
                onClick={() => remove(item)}
                className="hover:bg-red-50 hover:text-red-600"
                aria-label={`Hapus ${item.nama}`}
              />
            </li>
          ),
        )}
      </ul>

      {editing === 'baru' ? (
        <div className="rounded-lg p-3 ring-1 ring-slate-200">
          <OfficeForm
            submitLabel="Tambah kantor"
            onCancel={() => setEditing(null)}
            onSubmit={async (values) => {
              const id = await createOffice(values);
              toast.success(`${values.nama.trim()} ditambahkan.`);
              setEditing(null);
              onSelect(id);
            }}
          />
        </div>
      ) : (
        <Button variant="secondary" icon={Plus} onClick={() => setEditing('baru')}>
          Tambah kantor
        </Button>
      )}
    </div>
  );
}
