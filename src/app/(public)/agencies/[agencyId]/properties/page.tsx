'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AgencyPropertiesPage({ params }: { params: { agencyId: string } }) {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main agency page, which is now the properties list.
    router.replace(`/agencies/${params.agencyId}`);
  }, [router, params.agencyId]);

  // Render nothing, or a loading spinner, while redirecting.
  return null;
}
