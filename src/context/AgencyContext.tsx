'use client';
import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useUser, useFirestore, useMemoFirebase, useDoc, updateDocumentNonBlocking } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import type { UserProfile, Agency } from '@/lib/types';

type AgencyContextType = {
    userProfile: UserProfile | null;
    user: ReturnType<typeof useUser>['user'];
    agencyId: string | null;
    agency: Agency | null;
    isAgencyLoading: boolean;
};

const AgencyContext = createContext<AgencyContextType | undefined>(undefined);

export function AgencyProvider({ children }: { children: React.Node }) {
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

    // Self-healing mechanisms
    useEffect(() => {
        // Wait until all data is loaded to prevent premature actions
        if (isAgencyLoading || !user || !agency || !userProfile) {
            return;
        }

        const agencyDocRefForUpdate = doc(firestore, 'agencies', agency.id);

        // --- SELF-HEAL #1: Ensure agency owner is always in the agentIds list ---
        if (user.uid === agency.ownerId) {
            // Check if agentIds exists and if the owner is included
            if (!agency.agentIds || !agency.agentIds.includes(user.uid)) {
                console.warn(`Self-healing: Owner ${user.uid} is missing from agentIds list for agency ${agency.id}. Adding now.`);
                updateDoc(agencyDocRefForUpdate, {
                    agentIds: arrayUnion(user.uid)
                }).catch(err => console.error("Self-healing (owner) failed:", err));
            }

            // Also ensure owner's profile has correct role and agencyId
            const needsProfileUpdate = userProfile.role !== 'admin' || userProfile.agencyId !== agency.id;
            if (needsProfileUpdate) {
                console.warn(`Self-healing: Owner profile for ${user.uid} is out of sync. Correcting role and agencyId.`);
                const currentUserDocRef = doc(firestore, 'users', user.uid);
                updateDocumentNonBlocking(currentUserDocRef, {
                    role: 'admin',
                    agencyId: agency.id,
                });
            }
        }
        
        // --- SELF-HEAL #2: Ensure any user who thinks they're in an agency are in its agentIds list ---
        if (userProfile.agencyId === agency.id) {
            if (!agency.agentIds || !agency.agentIds.includes(user.uid)) {
                 console.warn(`Self-healing: User ${user.uid} believes they are in agency ${agency.id}, but are not in agentIds. Adding now.`);
                 updateDoc(agencyDocRefForUpdate, {
                    agentIds: arrayUnion(user.uid)
                 }).catch(err => console.error("Self-healing (agent) failed:", err));
            }
        }

    }, [isAgencyLoading, user, agency, userProfile, firestore]);


    const value: AgencyContextType = { 
        userProfile, 
        user,
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
