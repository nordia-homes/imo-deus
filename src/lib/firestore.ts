
// This is a placeholder for Firestore specific utility functions.
// For example, hooks for fetching collections/documents with multi-tenancy.
import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

// Example function to get documents for a specific agency
export async function getAgencyDocs(collectionName: string, agencyId: string) {
    if (!agencyId) {
        console.error("Agency ID is required for Firestore queries.");
        return [];
    }
    const q = query(collection(db, collectionName), where("agencyId", "==", agencyId));
    const querySnapshot = await getDocs(q);
    const docs: any[] = [];
    querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
    });
    return docs;
}
