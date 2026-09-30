'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useAuth, useUser } from '@/firebase';
import { collaborationApi } from '@/lib/collaboration/client';
import type { CollaborationAccount } from '@/lib/collaboration/model';

export default function CollaborationLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser(); const auth = useAuth(); const router = useRouter();
  const [account, setAccount] = useState<CollaborationAccount | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (isUserLoading) return;
    if (!user) { router.replace('/login'); return; }
    let active = true;
    collaborationApi<{ account: CollaborationAccount }>(user, '?view=me').then(data => { if (active) setAccount(data.account); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [isUserLoading, router, user]);
  if (!account) return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">{error || 'Se încarcă spațiul de colaborare…'}</main>;
  return <div className="min-h-screen bg-slate-950 text-white"><header className="border-b border-white/10 bg-slate-900"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4"><Link href="/collaboration" className="text-xl font-bold">ImoDeus <span className="text-emerald-400">Colaborări</span></Link><nav className="flex flex-wrap items-center gap-4 text-sm"><Link href="/collaboration" className="hover:text-emerald-300">Catalog și activitate</Link>{account.accountType === 'crm' && <Link href="/dashboard" className="hover:text-emerald-300">Înapoi în CRM</Link>}<span className="text-slate-300">{account.name} · {account.organizationName}</span><button onClick={() => void signOut(auth).then(() => router.replace('/login'))} className="text-slate-300 hover:text-white">Ieșire</button></nav></div></header>{children}</div>;
}
