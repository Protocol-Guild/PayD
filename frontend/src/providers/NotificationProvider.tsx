import React, { createContext, useContext, useState, ReactNode } from "react";

interface NotificationContextType {
  notify: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const notify = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    // Basic browser alert for now
    alert(`[${type.toUpperCase()}] ${message}`);
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
};
