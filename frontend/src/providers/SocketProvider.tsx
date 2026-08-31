import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNotification } from '../hooks/useNotification';
import { SocketContext } from '../hooks/useSocket';
import { API_ROOT_URL } from '../utils/api';

// Socket.IO connects to the API root (same host, no /api prefix)
const SOCKET_URL = API_ROOT_URL;

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const { notifySuccess, notifyError } = useNotification();

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'], // Allow fallback to polling
      reconnectionAttempts: 5,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setConnected(true);
      notifySuccess('Real-time updates connected');
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
      notifyError('Real-time updates disconnected');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setConnected(false);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [notifySuccess, notifyError]);

  const subscribeToTransaction = (transactionId: string) => {
    if (socket && connected) {
      socket.emit('subscribe:transaction', transactionId);
    }
  };

  const unsubscribeFromTransaction = (transactionId: string) => {
    if (socket && connected) {
      socket.emit('unsubscribe:transaction', transactionId);
    }
  };

  const subscribeToOrganization = (organizationId: number) => {
    if (socket && connected) {
      socket.emit('subscribe:organization', organizationId);
    }
  };

  const unsubscribeFromOrganization = (organizationId: number) => {
    if (socket && connected) {
      socket.emit('unsubscribe:organization', organizationId);
    }
  };

  return (
    <SocketContext
      value={{
        socket,
        connected,
        subscribeToTransaction,
        unsubscribeFromTransaction,
        subscribeToOrganization,
        unsubscribeFromOrganization,
      }}
    >
      {children}
    </SocketContext>
  );
};
