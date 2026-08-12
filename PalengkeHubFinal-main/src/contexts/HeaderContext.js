// src/contexts/HeaderContext.js
import React, { createContext, useContext, useState } from 'react';

const HeaderContext = createContext({
  isHeaderVisible: true,
  setIsHeaderVisible: () => {},
});

export const HeaderProvider = ({ children }) => {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  const value = {
    isHeaderVisible,
    setIsHeaderVisible,
  };

  return (
    <HeaderContext.Provider value={value}>
      {children}
    </HeaderContext.Provider>
  );
};

export const useHeader = () => {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error('useHeader must be used within a HeaderProvider');
  }
  return context;
};

export default HeaderProvider;