'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DemoLaunchPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/demo');
  }, [router]);

  return null;
}
