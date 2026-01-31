'use client';
import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useUser, useFirestore, useMemoFirebase, useDoc, updateDocumentNonBlocking } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
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
                // Check if their ID is missing from the agency's official list (or if the list doesn't exist)
                if (!agency.agentIds || !agency.agentIds.includes(user.uid)) {
                    console.log(`Self-healing: Adding agent ${user.uid} to agency ${agency.id}`);
                    const currentAgencyDocRef = doc(firestore, 'agencies', agency.id);
                    // This update uses the native SDK's updateDoc because it's a specific arrayUnion operation
                    // that needs to be validated by the isAddingSelfToAgency rule.
                    updateDoc(currentAgencyDocRef, {
                        agentIds: arrayUnion(user.uid)
                    }).catch(err => {
                        console.error("Self-healing agentIds update failed:", err);
                    });
                }
            }
        }
    }, [isAgencyLoading, user, agency, userProfile, firestore]);
    
    // Self-healing mechanism for the Agency Owner's admin role.
    useEffect(() => {
        if (!isAgencyLoading && user && agency && userProfile) {
            // If the current user is the owner of the agency...
            if (user.uid === agency.ownerId) {
                // ...and their profile doesn't reflect that they are an admin...
                if (userProfile.role !== 'admin') {
                    console.log(`Self-healing: Granting admin role to owner ${user.uid} for agency ${agency.id}.`);
                    // ...update their user profile to grant the role.
                    // This is a safe operation as it only affects the user's own document,
                    // and is allowed by the security rules.
                    const currentUserDocRef = doc(firestore, 'users', user.uid);
                    updateDocumentNonBlocking(currentUserDocRef, { role: 'admin' });
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
