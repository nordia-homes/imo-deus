
// This context is no longer used in the new simplified site structure.
'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';

export function AgencyProvider({ children }: { children: ReactNode }) {
  return (
    <>{children}</>
  );
}

export function useAgency() {
  return {};
}
