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

export function AgencyProvider({ children }: { children: ReactNode }) {
    const { user, isUserLoading: isUserAuthLoading } = useUser();
    const firestore = useFirestore();
    const [persistedAgencyId, setPersistedAgencyId] = React.useState<string | null>(null);
    const [hasLoadedPersistedAgencyId, setHasLoadedPersistedAgencyId] = React.useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            const storedAgencyId = window.localStorage.getItem('imodeus:lastAgencyId');
            setPersistedAgencyId(storedAgencyId || null);
        } catch (error) {
            console.warn('Could not read persisted agencyId from localStorage:', error);
            setPersistedAgencyId(null);
        } finally {
            setHasLoadedPersistedAgencyId(true);
        }
    }, []);

    // 1. Get current user's profile to find their agencyId
    const userDocRef = useMemoFirebase(() => {
        if (!user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);
    const agencyId = userProfile?.agencyId || persistedAgencyId || null;

    useEffect(() => {
        if (typeof window === 'undefined' || !userProfile?.agencyId) return;

        try {
            window.localStorage.setItem('imodeus:lastAgencyId', userProfile.agencyId);
            setPersistedAgencyId(userProfile.agencyId);
        } catch (error) {
            console.warn('Could not persist agencyId to localStorage:', error);
        }
    }, [userProfile?.agencyId]);

    // 2. Get the full agency document using the agencyId
    const agencyDocRef = useMemoFirebase(() => {
        if (!agencyId) return null;
        return doc(firestore, 'agencies', agencyId);
    }, [firestore, agencyId]);
    const { data: agency, isLoading: isAgencyDocLoading } = useDoc<Agency>(agencyDocRef);
    
    const isAgencyLoading = isUserAuthLoading || !hasLoadedPersistedAgencyId || isProfileLoading || (agencyId ? isAgencyDocLoading : false);

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
        // This component is likely on a public page. Return a safe, empty state
        // instead of throwing an error. Components using this hook should
        // handle the null state gracefully.
        return {
            userProfile: null,
            user: null,
            agencyId: null,
            agency: null,
            isAgencyLoading: true, // Set loading to true to avoid rendering incomplete public pages
        };
    }
    return context;
};
