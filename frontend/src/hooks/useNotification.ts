import { createContext, use } from 'react';

export interface NotificationMessages {
  loading: string;
  success: string;
  error: string;
}

export interface NotificationContextType {
  notify: (message: string) => void;
  notifySuccess: (message: string, description?: string) => void;
  notifyError: (message: string, description?: string, retryAction?: () => void) => void;
  /** Shows a loading toast; returns its id for later dismissal via notifyDismiss */
  notifyLoading: (message: string) => string | number;
  notifyDismiss: (id: string | number | undefined) => void;
  /** Automatically transitions a promise through loading → success/error toasts */
  notifyPromise: <T>(promise: Promise<T>, messages: NotificationMessages) => Promise<T>;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = use(NotificationContext);
  if (!context) throw new Error('useNotification must be used within NotificationProvider');
  return context;
};
