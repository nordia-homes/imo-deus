'use client';
import React, { createContext, useContext, ReactNode } from 'react';
import type { Agency } from '@/lib/types';

type PublicAgencyContextType = {
    agency: Agency | null;
    agencyId: string | null;
    isAgencyLoading: boolean;
};

const PublicAgencyContext = createContext<PublicAgencyContextType | undefined>(undefined);

// A simple wrapper provider. The actual logic will be in the layout.
export function PublicAgencyProvider({ 
    children, 
    value 
}: { 
    children: ReactNode,
    value: PublicAgencyContextType,
}) {
    return (
        <PublicAgencyContext.Provider value={value}>
            {children}
        </PublicAgencyContext.Provider>
    );
}

export const usePublicAgency = () => {
    const context = useContext(PublicAgencyContext);
    if (context === undefined) {
        throw new Error('usePublicAgency must be used within a PublicAgencyProvider');
    }
    return context;
};

/**
 * @deprecated Use `usePublicAgency` instead. This is an alias to fix an import error.
 */
export const useAgency = usePublicAgency;
