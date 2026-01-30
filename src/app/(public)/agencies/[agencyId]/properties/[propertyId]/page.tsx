
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { Property } from '@/lib/types';
import { notFound } from 'next/navigation';
import { PropertyClientView } from '@/components/public/PropertyClientView';

// Helper to get a memoized SSG Firebase app instance
function getSsgApp() {
    if (getApps().length > 0 && getApps().some(app => app.name === 'ssg-app')) {
        return getApps().find(app => app.name === 'ssg-app')!;
    }
    return initializeApp(firebaseConfig, 'ssg-app');
}

export default async function PublicPropertyDetailPage({ params }: { params: { agencyId: string, propertyId: string } }) {
  const ssgApp = getSsgApp();
  const firestore = getFirestore(ssgApp);

  const propRef = doc(firestore, 'agencies', params.agencyId, 'properties', params.propertyId);
  const propSnap = await getDoc(propRef);

  if (!propSnap.exists() || propSnap.data().status !== 'Activ') {
    notFound();
  }
  
  const property = { id: propSnap.id, ...propSnap.data() } as Property;
  
  // The server component now just fetches data and passes it to the client component
  return <PropertyClientView property={property} />;
}
