// src/contexts/ActiveScreenContext.js
// Lets a screen announce "I'm focused" directly, so App.js knows whether
// to show its global Header. Two earlier approaches both tried to INFER
// the active screen from outside (a nested Stack.Navigator's onStateChange
// prop, which silently does nothing since that prop only works on the
// root NavigationContainer; then a screenListeners focus listener on the
// navigator) and neither was reliably confirmed working. useFocusEffect is
// React Navigation's own primary, guaranteed-reliable "this screen just
// became focused" hook — every screen that needs the global header hidden
// should call announceActiveScreen(routeName) with it directly instead of
// depending on any external guess.
import React, { createContext, useContext } from 'react';

const ActiveScreenContext = createContext(() => {});

export const ActiveScreenProvider = ({ value, children }) => (
  <ActiveScreenContext.Provider value={value}>
    {children}
  </ActiveScreenContext.Provider>
);

export const useAnnounceActiveScreen = () => useContext(ActiveScreenContext);
