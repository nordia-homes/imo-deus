
'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Agency {
  id: string | null;
  name: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  customDomain: string | null;
}

interface AgencyContextType {
  agency: Agency;
  setAgency: (agency: Agency) => void;
}

const AgencyContext = createContext<AgencyContextType | undefined>(undefined);

export function AgencyProvider({ children }: { children: ReactNode }) {
  const [agency, setAgency] = useState<Agency>({
    id: 'agency-123', // placeholder
    name: 'EstateFlow', // placeholder
    logoUrl: null, // placeholder
    primaryColor: '#1E3A8A', // placeholder
    customDomain: null, // placeholder
  });

  return (
    <AgencyContext.Provider value={{ agency, setAgency }}>
      {children}
    </AgencyContext.Provider>
  );
}

export function useAgency() {
  const context = useContext(AgencyContext);
  if (context === undefined) {
    throw new Error('useAgency must be used within a AgencyProvider');
  }
  return context;
}
