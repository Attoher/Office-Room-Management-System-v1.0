import { useState } from 'react';
import { LockKeyhole, LogIn } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Field';
import { signInAdmin } from '../../services/authService';

/** Masuk Back Office dengan sandi akun admin (Firebase Authentication). */
export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInAdmin(password);
      // Berhasil: subscribeAdmin di BackOfficeView menampilkan isi halaman
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto max-w-sm">
      <CardBody>
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <LockKeyhole className="size-5" aria-hidden />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Masuk Back Office</p>
            <p className="text-sm text-slate-500">Masukkan sandi admin.</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Sandi" error={error}>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                error={error}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
              />
            )}
          </Field>
          <Button type="submit" icon={LogIn} loading={loading} className="w-full">
            Masuk
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
