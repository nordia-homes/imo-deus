'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { clearStoredRuntimeMode } from '@/lib/runtime-mode';

export default function DemoExitPage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    clearStoredRuntimeMode();
    signOut(auth).finally(() => {
      router.replace('/');
    });
  }, [auth, router]);

  return null;
}
