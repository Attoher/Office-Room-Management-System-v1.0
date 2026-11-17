import { useState } from 'react';
import { Save } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/feedbackContext';
import { useStatusRules } from '../../components/ui/statusRulesContext';
import {
  STATUS_ORDER,
  getOccupancyStatus,
  hasOwnRules,
  statusMeta,
  validateStatusRules,
} from '../../domain/occupancy';
import { setRoomStatusRules } from '../../services/roomService';

/** Pilih aturan status ruangan: ikut aturan umum, atau batas kuning/merah sendiri. */
export default function RoomRulesCard({ room }) {
  const toast = useToast();
  const { rules: general } = useStatusRules();
  const own = hasOwnRules(room);
  const [custom, setCustom] = useState(own);
  const [values, setValues] = useState({
    kuning: String(own ? room.batas_kuning : general.kuning),
    merah: String(own ? room.batas_merah : general.merah),
  });
  const [saving, setSaving] = useState(false);

  const { value, errors } = validateStatusRules(values);
  const valid = Object.keys(errors).length === 0;
  const preview = custom && valid ? value : general;
  const meta = statusMeta(preview);
  // Status ruangan ini bila aturan di form disimpan
  const previewStatus = getOccupancyStatus(
    { ...room, batas_kuning: preview.kuning, batas_merah: preview.merah },
    general,
  );
  const changed = custom
    ? valid && (!own || value.kuning !== room.batas_kuning || value.merah !== room.batas_merah)
    : own;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await setRoomStatusRules(room, custom ? values : null);
      toast.success(
        custom
          ? `${room.nama_ruangan} memakai aturan sendiri.`
          : `${room.nama_ruangan} kembali ke aturan umum.`,
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const option = (checked, label, hint, onSelect) => (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 ring-inset ${
        checked ? 'bg-blue-50 ring-blue-200' : 'ring-slate-200 hover:bg-slate-50'
      }`}
    >
      <input
        type="radio"
        name={`aturan-${room.id}`}
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 size-4 text-blue-600"
      />
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );

  return (
    <Card className="print:break-inside-avoid">
      <CardHeader
        title="Aturan status ruangan ini"
        description={own ? 'Memakai aturan sendiri.' : 'Mengikuti aturan umum.'}
      />
      <CardBody>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-2 print:hidden">
            {option(
              !custom,
              'Ikuti aturan umum',
              `Kuning mulai ${general.kuning}%, merah mulai ${general.merah}% (tab Aturan status)`,
              () => setCustom(false),
            )}
            {option(
              custom,
              'Aturan sendiri',
              'Mis. ruang server merah lebih awal, lobby lebih longgar',
              () => setCustom(true),
            )}
          </div>

          {custom && (
            <div className="grid grid-cols-2 gap-3 print:hidden">
              <Field label="Kuning mulai (%)" error={errors.kuning}>
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    value={values.kuning}
                    error={errors.kuning}
                    onChange={(e) => setValues((v) => ({ ...v, kuning: e.target.value }))}
                  />
                )}
              </Field>
              <Field label="Merah mulai (%)" error={errors.merah}>
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={100}
                    value={values.merah}
                    error={errors.merah}
                    onChange={(e) => setValues((v) => ({ ...v, merah: e.target.value }))}
                  />
                )}
              </Field>
            </div>
          )}

          <ul className="grid grid-cols-3 gap-2">
            {STATUS_ORDER.map((key) => (
              <li
                key={key}
                className={`rounded-md px-2 py-1.5 text-center ring-1 ring-inset ${meta[key].badge} ${
                  key === previewStatus ? 'ring-2' : 'opacity-70'
                }`}
              >
                <span className="block text-xs font-semibold">{meta[key].label}</span>
                <span className="block text-sm font-semibold tabular-nums">{meta[key].range}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            Dengan aturan ini, ruangan sekarang berstatus{' '}
            <span className={`font-medium ${meta[previewStatus].text}`}>
              {meta[previewStatus].label}
            </span>
            .
          </p>

          <div className="flex justify-end print:hidden">
            <Button type="submit" icon={Save} loading={saving} disabled={!changed}>
              Simpan aturan ruangan
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
