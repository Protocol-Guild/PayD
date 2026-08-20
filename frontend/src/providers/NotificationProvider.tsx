import React, { useCallback } from 'react';
import { toast } from 'sonner';
import { NotificationContext, NotificationMessages } from '../hooks/useNotification';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const notify = useCallback((message: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    (toast as any)(message);
  }, []);

  const notifySuccess = useCallback((message: string, description?: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    (toast as any).success(message, { description });
  }, []);

  const notifyError = useCallback(
    (message: string, description?: string, retryAction?: () => void) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      (toast as any).error(message, {
        description,
        action: retryAction
          ? {
              label: 'Retry',
              onClick: () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
                void (toast as any).promise(retryAction(), {
                  loading: 'Retrying…',
                  success: 'Operation completed',
                  error: 'Retry failed',
                });
              },
            }
          : undefined,
      });
    },
    []
  );

  const notifyLoading = useCallback((message: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const id = (toast as any).loading(message);
    return id as string | number;
  }, []);

  const notifyDismiss = useCallback((id: string | number | undefined) => {
    if (id === undefined) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    (toast as any).dismiss(id);
  }, []);

  const notifyPromise = useCallback(async <T,>(promise: Promise<T>, messages: NotificationMessages): Promise<T> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    (toast as any).promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    });
    return promise;
  }, []);

  return (
    <NotificationContext
      value={{ notify, notifySuccess, notifyError, notifyLoading, notifyDismiss, notifyPromise }}
    >
      {children}
    </NotificationContext>
  );
};
