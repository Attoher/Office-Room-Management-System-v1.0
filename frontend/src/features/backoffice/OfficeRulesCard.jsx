import { useState } from 'react';
import { ArrowRight, RotateCcw, Save } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/feedbackContext';
import {
  DEFAULT_STATUS_RULES,
  STATUS_ORDER,
  formatPercent,
  getOccupancyPercent,
  getOccupancyStatus,
  hasOwnRules,
  officeStatusRules,
  statusMeta,
  summarizeRooms,
  validateStatusRules,
} from '../../domain/occupancy';
import { setOfficeStatusRules } from '../../services/officeService';

const MAX_CHANGES = 5;

/** Batas kuning & merah kantor ini, dengan pratinjau dampaknya ke ruangan sebelum disimpan. */
export default function OfficeRulesCard({ office, rooms }) {
  const toast = useToast();
  const current = officeStatusRules(office);
  const own = hasOwnRules(office);
  const [values, setValues] = useState({
    kuning: String(current.kuning),
    merah: String(current.merah),
  });
  const [saving, setSaving] = useState(false);

  const { value, errors } = validateStatusRules(values);
  const valid = Object.keys(errors).length === 0;
  const preview = valid ? value : current;
  const meta = statusMeta(preview);
  const currentMeta = statusMeta(current);
  const changed = valid && (value.kuning !== current.kuning || value.merah !== current.merah);
  const summary = summarizeRooms(rooms, preview);
  const changes = rooms
    .map((room) => ({
      room,
      from: getOccupancyStatus(room, current),
      to: getOccupancyStatus(room, preview),
    }))
    .filter((c) => c.from !== c.to)
    .sort((a, b) => getOccupancyPercent(b.room) - getOccupancyPercent(a.room));

  const save = async (rules) => {
    setSaving(true);
    try {
      await setOfficeStatusRules(office, rules);
      toast.success(
        rules
          ? `Aturan status ${office.nama} disimpan.`
          : `${office.nama} kembali ke aturan bawaan.`,
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="print:break-inside-avoid">
      <CardHeader
        title="Aturan status kantor ini"
        description={
          own
            ? 'Memakai aturan sendiri.'
            : `Memakai aturan bawaan (kuning ${DEFAULT_STATUS_RULES.kuning}%, merah ${DEFAULT_STATUS_RULES.merah}%).`
        }
      />
      <CardBody>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save(values);
          }}
          className="space-y-4"
        >
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

          <ul className="grid grid-cols-3 gap-2">
            {STATUS_ORDER.map((key) => (
              <li
                key={key}
                className={`rounded-md px-2 py-1.5 text-center ring-1 ring-inset ${meta[key].badge}`}
              >
                <span className="block text-xs font-semibold">{meta[key].label}</span>
                <span className="block text-sm font-semibold tabular-nums">{meta[key].range}</span>
                <span className="block text-xs tabular-nums opacity-80">
                  {summary.byStatus[key]} ruangan
                </span>
              </li>
            ))}
          </ul>

          {changed && (
            <div className="print:hidden">
              <p className="mb-1.5 text-sm font-medium text-slate-700">
                {changes.length === 0
                  ? 'Tidak ada ruangan yang berubah status'
                  : `${changes.length} ruangan berubah status`}
              </p>
              <ul className="space-y-1">
                {changes.slice(0, MAX_CHANGES).map(({ room, from, to }) => (
                  <li key={room.id} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-slate-700">
                      {room.nama_ruangan}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">
                      {formatPercent(getOccupancyPercent(room))}
                    </span>
                    <span className={`shrink-0 text-xs font-medium ${currentMeta[from].text}`}>
                      {currentMeta[from].label}
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                    <span className={`shrink-0 text-xs font-medium ${meta[to].text}`}>
                      {meta[to].label}
                    </span>
                  </li>
                ))}
                {changes.length > MAX_CHANGES && (
                  <li className="text-xs text-slate-500">
                    dan {changes.length - MAX_CHANGES} ruangan lainnya
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 print:hidden">
            {own && (
              <Button
                variant="secondary"
                icon={RotateCcw}
                disabled={saving}
                onClick={() => save(null)}
              >
                Kembali ke bawaan
              </Button>
            )}
            <Button type="submit" icon={Save} loading={saving} disabled={!changed}>
              Simpan aturan
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
