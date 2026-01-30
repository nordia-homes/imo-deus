'use client';
import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile, Agency } from '@/lib/types';

type AgencyContextType = {
    userProfile: UserProfile | null;
    agencyId: string | null;
    agency: Agency | null;
    isAgencyLoading: boolean;
};

const AgencyContext = createContext<AgencyContextType | undefined>(undefined);

export function AgencyProvider({ children }: { children: ReactNode }) {
    const { user, isUserLoading: isUserAuthLoading } = useUser();
    const firestore = useFirestore();

    // 1. Get current user's profile to find their agencyId
    const userDocRef = useMemoFirebase(() => {
        if (!user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);
    const agencyId = userProfile?.agencyId || null;

    // 2. Get the full agency document using the agencyId
    const agencyDocRef = useMemoFirebase(() => {
        if (!agencyId) return null;
        return doc(firestore, 'agencies', agencyId);
    }, [firestore, agencyId]);
    const { data: agency, isLoading: isAgencyDocLoading } = useDoc<Agency>(agencyDocRef);
    
    // The overall loading state is a chain: user must be loaded, then profile, then agency.
    const isAgencyLoading = isUserAuthLoading || isProfileLoading || isAgencyDocLoading;

    const value: AgencyContextType = { 
        userProfile, 
        agencyId, 
        agency, 
        isAgencyLoading,
    };

    return (
        <AgencyContext.Provider value={value}>
            {children}
        </AgencyContext.Provider>
    );
}

export const useAgency = () => {
    const context = useContext(AgencyContext);
    if (context === undefined) {
        throw new Error('useAgency must be used within an AgencyProvider');
    }
    return context;
};
