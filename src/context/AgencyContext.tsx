'use client';
import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
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
    
    const isAgencyLoading = isUserAuthLoading || isProfileLoading || isAgencyDocLoading;

    // Self-healing mechanism for agents whose registration might have partially failed.
    useEffect(() => {
        // Run only when all data is loaded and valid
        if (!isAgencyLoading && user && agency && userProfile) {
            // Check if user is an agent and belongs to this agency according to their profile
            if (userProfile.agencyId === agency.id) {
                // Check if their ID is missing from the agency's official list
                if (agency.agentIds && !agency.agentIds.includes(user.uid)) {
                    console.log(`Self-healing: Adding agent ${user.uid} to agency ${agency.id}`);
                    const currentAgencyDocRef = doc(firestore, 'agencies', agency.id);
                    // Use updateDoc with arrayUnion to safely add the ID.
                    // This will trigger the 'isAddingSelfToAgency' security rule for validation.
                    updateDoc(currentAgencyDocRef, {
                        agentIds: arrayUnion(user.uid)
                    }).catch(err => {
                        // Log this for debugging, but don't crash the app.
                        // This might happen if the rules are still not perfect, but it shouldn't.
                        console.error("Self-healing update failed:", err);
                    });
                }
            }
        }
    }, [isAgencyLoading, user, agency, userProfile, firestore]);

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
