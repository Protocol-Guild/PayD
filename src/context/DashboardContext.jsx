import React, { createContext, useState, useCallback } from 'react';

export const DashboardContext = createContext();

export const DashboardProvider = ({ children }) => {
  const [cards, setCards] = useState([]);

  const addCard = useCallback((card) => {
    setCards(prev => [...prev, card]);
  }, []);

  const removeCard = useCallback((title) => {
    setCards(prev => prev.filter(card => card.title !== title));
  }, []);

  const value = {
    cards,
    addCard,
    removeCard
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};
