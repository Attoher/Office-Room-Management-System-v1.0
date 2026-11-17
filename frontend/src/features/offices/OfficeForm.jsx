import { useState } from 'react';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';

/**
 * Form nama, alamat, dan PIC (penanggung jawab) kantor. `onSubmit(values)` boleh melempar error;
 * pesannya ditampilkan.
 */
export default function OfficeForm({
  initialValues = { nama: '', alamat: '', pic_nama: '', pic_telp: '' },
  submitLabel,
  onSubmit,
  onCancel,
}) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit(values);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
          {error}
        </p>
      )}
      <Field label="Nama kantor">
        {(id) => (
          <Input
            id={id}
            value={values.nama}
            maxLength={60}
            placeholder="Contoh: Kantor Pusat Surabaya"
            onChange={(e) => setValues((v) => ({ ...v, nama: e.target.value }))}
          />
        )}
      </Field>
      <Field label="Alamat (opsional)">
        {(id) => (
          <Input
            id={id}
            value={values.alamat}
            maxLength={120}
            placeholder="Contoh: Jl. Raya ITS, Sukolilo"
            onChange={(e) => setValues((v) => ({ ...v, alamat: e.target.value }))}
          />
        )}
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nama PIC">
          {(id) => (
            <Input
              id={id}
              value={values.pic_nama}
              maxLength={60}
              autoComplete="name"
              placeholder="Contoh: Budi Santoso"
              onChange={(e) => setValues((v) => ({ ...v, pic_nama: e.target.value }))}
            />
          )}
        </Field>
        <Field label="No. telepon PIC" hint="8–15 angka, boleh diawali +62">
          {(id) => (
            <Input
              id={id}
              type="tel"
              inputMode="tel"
              value={values.pic_telp}
              maxLength={20}
              autoComplete="tel"
              placeholder="Contoh: 081234567890"
              onChange={(e) => setValues((v) => ({ ...v, pic_telp: e.target.value }))}
            />
          )}
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Batal
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
