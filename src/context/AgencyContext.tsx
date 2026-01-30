'use client';
import React, { createContext, useContext, ReactNode } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';

type AgencyContextType = {
    userProfile: UserProfile | null;
    agencyId: string | null;
    isAgencyLoading: boolean;
};

const AgencyContext = createContext<AgencyContextType | null>(null);

export function AgencyProvider({ children }: { children: ReactNode }) {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemoFirebase(() => {
        if (!user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);

    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

    const isAgencyLoading = isUserLoading || isProfileLoading;
    const agencyId = userProfile?.agencyId || null;

    const value = { userProfile, agencyId, isAgencyLoading };

    return (
        <AgencyContext.Provider value={value}>
            {children}
        </AgencyContext.Provider>
    );
}

export const useAgency = () => {
    const context = useContext(AgencyContext);
    if (!context) {
        throw new Error('useAgency must be used within an AgencyProvider');
    }
    return context;
};
