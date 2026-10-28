import { useCallback, useMemo, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import Button from './Button';
import Modal from './Modal';
import { FeedbackContext } from './feedbackContext';

const TOAST_DURATION = 3500;

/** Pengganti alert()/confirm() bawaan browser: toast di pojok + dialog konfirmasi. */
export default function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const nextId = useRef(0);

  const show = useCallback((type, message) => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { id, type, message }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), TOAST_DURATION);
  }, []);

  const toast = useMemo(
    () => ({
      success: (message) => show('success', message),
      error: (message) => show('error', message),
    }),
    [show],
  );

  const confirm = useCallback(
    (options) => new Promise((resolve) => setDialog({ ...options, resolve })),
    [],
  );

  const closeDialog = (result) => {
    dialog.resolve(result);
    setDialog(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
        aria-live="polite"
      >
        {toasts.map(({ id, type, message }) => {
          const Icon = type === 'success' ? CheckCircle2 : XCircle;
          return (
            <div
              key={id}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg bg-white p-3 text-sm shadow-lg ring-1 ring-slate-200"
            >
              <Icon
                className={`mt-0.5 size-5 shrink-0 ${type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}
                aria-hidden
              />
              <p className="text-slate-700">{message}</p>
            </div>
          );
        })}
      </div>

      <Modal
        open={Boolean(dialog)}
        size="sm"
        title={dialog?.title ?? ''}
        onClose={() => closeDialog(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => closeDialog(false)}>
              Batal
            </Button>
            <Button
              variant={dialog?.danger ? 'danger' : 'primary'}
              onClick={() => closeDialog(true)}
              data-autofocus
            >
              {dialog?.confirmLabel ?? 'Ya'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{dialog?.message}</p>
      </Modal>
    </FeedbackContext.Provider>
  );
}
