import { createContext, useContext, useMemo, useState } from 'react';

const UnsavedChangesContext = createContext(null);

export function UnsavedChangesProvider({ children }) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const value = useMemo(() => ({ hasUnsavedChanges, setHasUnsavedChanges }), [hasUnsavedChanges]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error('useUnsavedChanges must be used inside UnsavedChangesProvider');
  }
  return context;
}
