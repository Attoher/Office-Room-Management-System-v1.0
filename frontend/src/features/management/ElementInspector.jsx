import { useState } from 'react';
import { RotateCw, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { useToast } from '../../components/ui/feedbackContext';
import {
  ELEMENT_TYPES,
  FURNITURE,
  ROOM_SIDES,
  clampFurniture,
  furnitureError,
} from '../../domain/elements';
import { deleteElement, updateElement } from '../../services/elementService';

/** Detail elemen terpilih di editor: jendela, kolom, atau furnitur. */
export default function ElementInspector({
  element,
  roomsById,
  elements,
  doors,
  onClose,
  onSelectRoom,
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const room = element.room_id != null ? roomsById.get(element.room_id) : null;
  const ctx = { roomsById, elements, doors };

  const run = async (key, action) => {
    setBusy(key);
    try {
      await action();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(null);
    }
  };

  const update = (key, changes) => run(key, () => updateElement(element, changes, ctx));

  const title =
    element.jenis === 'furnitur'
      ? (FURNITURE[element.model]?.label ?? 'Furnitur')
      : ELEMENT_TYPES[element.jenis].label;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-900">{title}</p>
          {room && (
            <button
              type="button"
              onClick={() => onSelectRoom(room.id)}
              className="mt-0.5 text-xs text-blue-600 hover:underline"
            >
              di {room.nama_ruangan}
            </button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          icon={Trash2}
          loading={busy === 'delete'}
          onClick={() =>
            run('delete', async () => {
              await deleteElement(element.id);
              onClose();
            })
          }
          className="hover:bg-red-50 hover:text-red-600"
          aria-label={`Hapus ${title}`}
        />
      </div>

      {element.jenis === 'jendela' && (
        <WindowForm
          key={`${element.sisi}-${element.lebar}`}
          element={element}
          busy={busy}
          update={update}
        />
      )}

      {element.jenis === 'kolom' && (
        <ColumnForm
          key={`${element.w}-${element.h}`}
          element={element}
          busy={busy}
          update={update}
        />
      )}

      {element.jenis === 'furnitur' && room && (
        <div className="space-y-3">
          <Field label="Jenis furnitur">
            {(id) => (
              <Select
                id={id}
                value={element.model}
                onChange={(e) => {
                  const next = { ...element, model: e.target.value };
                  update('model', { model: next.model, ...clampFurniture(next, room) });
                }}
              >
                {Object.entries(FURNITURE).map(([key, model]) => (
                  <option key={key} value={key}>
                    {model.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              Diputar {element.rotasi}° · {FURNITURE[element.model]?.seats ?? 0} kursi
            </p>
            <Button
              variant="secondary"
              size="sm"
              icon={RotateCw}
              loading={busy === 'rotate'}
              onClick={() => {
                const next = { ...element, rotasi: (element.rotasi + 90) % 360 };
                update('rotate', { rotasi: next.rotasi, ...clampFurniture(next, room) });
              }}
            >
              Putar 90°
            </Button>
          </div>
          {furnitureError(element, room) && (
            <p className="text-xs text-amber-700">
              Furnitur keluar dari ruangan (mungkin ruangannya diperkecil). Geser atau putar agar
              muat.
            </p>
          )}
          <p className="text-xs text-slate-500">
            Geser furnitur langsung di denah untuk memindahkannya.
          </p>
        </div>
      )}
    </div>
  );
}

function WindowForm({ element, busy, update }) {
  const [lebar, setLebar] = useState(String(element.lebar));
  return (
    <div className="space-y-3">
      <Field label="Sisi ruangan">
        {(id) => (
          <Select
            id={id}
            value={element.sisi}
            onChange={(e) => update('sisi', { sisi: e.target.value, offset: null })}
          >
            {Object.entries(ROOM_SIDES).map(([key, side]) => (
              <option key={key} value={key}>
                {side.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          update('lebar', { lebar: Number(lebar) });
        }}
      >
        <div className="flex-1">
          <Field label="Lebar (m)">
            {(id) => (
              <Input
                id={id}
                type="number"
                step="0.1"
                min="0.4"
                value={lebar}
                onChange={(e) => setLebar(e.target.value)}
              />
            )}
          </Field>
        </div>
        <Button type="submit" variant="secondary" loading={busy === 'lebar'}>
          Terapkan
        </Button>
      </form>
      <p className="text-xs text-slate-500">
        Geser jendela di denah untuk memindahkannya sepanjang dinding.
      </p>
    </div>
  );
}

function ColumnForm({ element, busy, update }) {
  const [size, setSize] = useState({ w: String(element.w), h: String(element.h) });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        update('size', { w: Number(size.w), h: Number(size.h) });
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        {[
          ['w', 'Panjang (m)'],
          ['h', 'Lebar (m)'],
        ].map(([key, label]) => (
          <Field key={key} label={label}>
            {(id) => (
              <Input
                id={id}
                type="number"
                step="0.1"
                min="0.1"
                max="3"
                value={size[key]}
                onChange={(e) => setSize((s) => ({ ...s, [key]: e.target.value }))}
              />
            )}
          </Field>
        ))}
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" size="sm" loading={busy === 'size'}>
          Terapkan
        </Button>
      </div>
      <p className="text-xs text-slate-500">Geser kolom di denah untuk memindahkannya.</p>
    </form>
  );
}
