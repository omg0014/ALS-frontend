import { createContext, useContext } from 'react'

// Toast messages: const toast = useToast(); toast.ok('Saved'); toast.error('Could not save')
export const ToastContext = createContext(null)
export const useToast = () => useContext(ToastContext)

// Confirmation dialog: if (await confirm({ title, message, confirmLabel, tone: 'danger' })) { ... }
export const ConfirmContext = createContext(null)
export const useConfirm = () => useContext(ConfirmContext)
