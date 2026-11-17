import { useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/feedbackContext';
import {
  DEFAULT_STATUS_RULES,
  STATUS_ORDER,
  statusMeta,
  validateStatusRules,
} from '../../domain/occupancy';
import { saveStatusRules } from '../../services/settingsService';
import StatusImpact from './StatusImpact';

/** Ubah batas persen kuning & merah. Berlaku untuk semua kantor dan semua halaman. */
export default function StatusRulesForm({ rules, offices, floors, rooms }) {
  const toast = useToast();
  const [values, setValues] = useState({
    kuning: String(rules.kuning),
    merah: String(rules.merah),
  });
  const [saving, setSaving] = useState(false);

  const { value, errors } = validateStatusRules(values);
  const valid = Object.keys(errors).length === 0;
  const preview = valid ? value : rules;
  const meta = statusMeta(preview);
  const changed = valid && (value.kuning !== rules.kuning || value.merah !== rules.merah);
  const widths = {
    hijau: preview.kuning,
    kuning: preview.merah - preview.kuning,
    merah: 100 - preview.merah,
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await saveStatusRules(values);
      toast.success('Aturan status disimpan dan langsung berlaku di semua halaman.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Aturan status ruangan"
          description="Persen = jumlah orang ÷ kapasitas ruangan. Berlaku untuk semua kantor."
        />
        <CardBody>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Kuning mulai dari (%)"
                error={errors.kuning}
                hint={`Di bawah ini hijau (${meta.hijau.range})`}
              >
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    step={1}
                    value={values.kuning}
                    error={errors.kuning}
                    onChange={(e) => setValues((v) => ({ ...v, kuning: e.target.value }))}
                  />
                )}
              </Field>
              <Field
                label="Merah mulai dari (%)"
                error={errors.merah}
                hint="Isi 100 bila merah hanya untuk ruangan penuh"
              >
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={100}
                    step={1}
                    value={values.merah}
                    error={errors.merah}
                    onChange={(e) => setValues((v) => ({ ...v, merah: e.target.value }))}
                  />
                )}
              </Field>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Pratinjau</p>
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                {STATUS_ORDER.map((key) =>
                  widths[key] > 0 ? (
                    <div key={key} className={meta[key].bar} style={{ width: `${widths[key]}%` }} />
                  ) : null,
                )}
              </div>
              <div className="mt-1 flex justify-between text-xs tabular-nums text-slate-400">
                <span>0%</span>
                <span>100%</span>
              </div>
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {STATUS_ORDER.map((key) => (
                  <li
                    key={key}
                    className={`rounded-lg px-3 py-2 ring-1 ring-inset ${meta[key].badge}`}
                  >
                    <p className="text-xs font-semibold">
                      {meta[key].label} · {meta[key].description}
                    </p>
                    <p className="text-lg font-semibold tabular-nums">{meta[key].range}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                icon={RotateCcw}
                disabled={saving}
                onClick={() =>
                  setValues({
                    kuning: String(DEFAULT_STATUS_RULES.kuning),
                    merah: String(DEFAULT_STATUS_RULES.merah),
                  })
                }
              >
                Nilai bawaan ({DEFAULT_STATUS_RULES.kuning}% / {DEFAULT_STATUS_RULES.merah}%)
              </Button>
              <Button type="submit" icon={Save} loading={saving} disabled={!changed}>
                Simpan aturan
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
      <StatusImpact
        offices={offices}
        floors={floors}
        rooms={rooms}
        current={rules}
        preview={preview}
      />
    </div>
  );
}
