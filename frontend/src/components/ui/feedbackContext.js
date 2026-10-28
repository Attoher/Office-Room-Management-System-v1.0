import { createContext, useContext } from 'react';

export const FeedbackContext = createContext(null);

/** toast.success(msg) / toast.error(msg) */
export function useToast() {
  return useContext(FeedbackContext).toast;
}

/** await confirm({ title, message, confirmLabel, danger }) → true/false */
export function useConfirm() {
  return useContext(FeedbackContext).confirm;
}
