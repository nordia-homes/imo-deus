'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { Building2, Home, LayoutDashboard, LogOut, Shield, Users } from 'lucide-react';
import React, { useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useAuth, useFirestore, useMemoFirebase, useDoc, useUser } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

function FullScreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#08111F] text-white">
      <div className="h-12 w-12 animate-pulse rounded-full bg-white/10" />
    </div>
  );
}

function getInitials(name?: string | null) {
  if (!name) return 'MA';
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function MasterAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/login');
      return;
    }

    if (!isUserLoading && !isProfileLoading && !userProfile) {
      router.replace('/dashboard');
      return;
    }

    if (!isUserLoading && !isProfileLoading && userProfile && userProfile.role !== 'platform_admin') {
      router.replace('/dashboard');
    }
  }, [isProfileLoading, isUserLoading, router, user, userProfile]);

  if (isUserLoading || !user || isProfileLoading || !userProfile) {
    return <FullScreenLoader />;
  }

  if (userProfile.role !== 'platform_admin') {
    return <FullScreenLoader />;
  }

  const navItems = [
    { href: '/master-admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/master-admin/agencies', label: 'Agenții', icon: Building2 },
    { href: '/master-admin/users', label: 'Utilizatori', icon: Users },
    { href: '/master-admin/properties', label: 'Proprietăți', icon: Home },
    { href: '/master-admin/leads', label: 'Leads', icon: Shield },
  ];

  return (
    <div className="h-screen overflow-hidden bg-[#08111F] text-white">
      <div className="grid h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex h-screen flex-col border-r border-white/8 bg-[linear-gradient(180deg,_rgba(7,15,28,0.98)_0%,_rgba(6,12,22,1)_100%)] px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-100/70">Master Admin</p>
              <p className="text-lg font-semibold text-white">ImoDeus Control</p>
            </div>
          </div>

          <nav className="mt-8 flex-1 space-y-2 overflow-y-auto pr-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition',
                    isActive ? 'bg-emerald-400/14 text-white' : 'text-white/70 hover:bg-white/6 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 border border-white/10">
                <AvatarImage src={user.photoURL || undefined} />
                <AvatarFallback className="bg-white/10 text-white">{getInitials(userProfile.name || user.email)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{userProfile.name || 'Platform Admin'}</p>
                <p className="truncate text-sm text-white/60">{userProfile.email || user.email}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full border-white/15 bg-white/6 text-white hover:bg-white/12"
              onClick={() => signOut(auth).then(() => router.push('/login'))}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Deconectare
            </Button>
          </div>
        </aside>

        <div className="flex h-screen min-w-0 flex-col overflow-hidden">
          <header className="sticky top-0 z-20 border-b border-white/8 bg-[#08111F]/90 px-4 py-4 backdrop-blur md:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-white/45">Platform Overview</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Control global pentru toate agențiile</h1>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 md:flex">
                <Users className="h-4 w-4 text-emerald-200" />
                <span>Acces platform admin</span>
              </div>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
