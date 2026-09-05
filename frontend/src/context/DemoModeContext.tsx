import React, { createContext, useContext, useState } from "react";

interface DemoModeContextType {
  demoMode: boolean;
  toggleDemoMode: () => void;
  setDemoMode: (enabled: boolean | ((prev: boolean) => boolean)) => void;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

export const DemoModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [demoMode, setDemoMode] = useState<boolean>(false);

  const toggleDemoMode = () => setDemoMode((prev) => !prev);

  return (
    <DemoModeContext.Provider value={{ demoMode, toggleDemoMode, setDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  );
};

export const useDemoMode = () => {
  const context = useContext(DemoModeContext);
  if (!context) {
    throw new Error("useDemoMode must be used within a DemoModeProvider");
  }
  return context;
};
