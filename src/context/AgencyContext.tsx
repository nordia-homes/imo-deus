'use client';
import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile, Agency } from '@/lib/types';

type AgencyContextType = {
    userProfile: UserProfile | null;
    agencyId: string | null;
    agency: Agency | null;
    agents: UserProfile[];
    isAgencyLoading: boolean; // This will now cover loading agents as well
};

const AgencyContext = createContext<AgencyContextType | undefined>(undefined);

export function AgencyProvider({ children }: { children: ReactNode }) {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    // 1. Get current user's profile to find agencyId
    const userDocRef = useMemoFirebase(() => {
        if (!user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);
    const agencyId = userProfile?.agencyId || null;

    // 2. Get the agency document
    const agencyDocRef = useMemoFirebase(() => {
        if (!agencyId) return null;
        return doc(firestore, 'agencies', agencyId);
    }, [firestore, agencyId]);
    const { data: agencyData, isLoading: isAgencyDocLoading } = useDoc<Agency>(agencyDocRef);
    
    // 3. NEW LOGIC: Fetch agent profiles based on agentIds from the agency doc
    const [agents, setAgents] = useState<UserProfile[]>([]);
    const [areAgentsLoading, setAreAgentsLoading] = useState(true);

    useEffect(() => {
        // This effect runs when agencyData is loaded or changes.
        if (!agencyData) {
            // If there's no agency data (e.g., user is new), and we are done checking, then there are no agents.
            if (!isAgencyDocLoading) {
                setAgents([]);
                setAreAgentsLoading(false);
            }
            return;
        }

        if (!agencyData.agentIds || agencyData.agentIds.length === 0) {
            setAgents([]);
            setAreAgentsLoading(false);
            return;
        }

        const fetchAgents = async () => {
            setAreAgentsLoading(true);
            try {
                // Fetch each agent's profile using getDoc. This is a series of `get` requests, not a `list`.
                const agentPromises = agencyData.agentIds!.map(id => getDoc(doc(firestore, 'users', id)));
                const agentDocs = await Promise.all(agentPromises);
                const agentProfiles = agentDocs
                    .filter(docSnap => docSnap.exists())
                    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as UserProfile));
                setAgents(agentProfiles);
            } catch (error) {
                console.error("Error fetching agent profiles in context:", error);
                setAgents([]); // Clear agents on error
            } finally {
                setAreAgentsLoading(false);
            }
        };

        fetchAgents();
    }, [agencyData, isAgencyDocLoading, firestore]);

    // The overall loading state depends on all async operations.
    const isAgencyLoading = isUserLoading || isProfileLoading || isAgencyDocLoading || areAgentsLoading;

    const value = { userProfile, agencyId, agency: agencyData, agents, isAgencyLoading };

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
