'use client';

import { useEffect, useMemo, useState } from 'react';
import { Mail, Phone, Search, Shield, Users } from 'lucide-react';
import { useUser } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type UserItem = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'agent' | 'platform_admin' | 'unknown';
  agencyName: string;
};

const ROLE_LABELS: Record<UserItem['role'], string> = {
  admin: 'Admin agenție',
  agent: 'Agent',
  platform_admin: 'Platform admin',
  unknown: 'Necunoscut',
};

export default function MasterAdminUsersPage() {
  const { user } = useUser();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserItem['role']>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setUsers([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const activeUser = user;

    async function loadData() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const token = await activeUser.getIdToken(true);
        const response = await fetch('/api/master-admin/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || 'Nu am putut încărca utilizatorii.');
        }
        if (!isMounted) return;
        setUsers(Array.isArray(payload?.users) ? payload.users : []);
      } catch (error) {
        if (!isMounted) return;
        setUsers([]);
        setErrorMessage(error instanceof Error ? error.message : 'Nu am putut încărca utilizatorii.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return users.filter((entry) => {
      const matchesRole = roleFilter === 'all' ? true : entry.role === roleFilter;
      const matchesQuery = normalizedQuery
        ? [entry.name, entry.email, entry.phone, entry.agencyName, ROLE_LABELS[entry.role]].join(' ').toLowerCase().includes(normalizedQuery)
        : true;
      return matchesRole && matchesQuery;
    });
  }, [query, roleFilter, users]);

  return (
    <div className="space-y-6 text-white">
      <Card className="border-none bg-[#10213A] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-emerald-200" /> Utilizatorii platformei</CardTitle>
          <CardDescription className="text-white/68">
            Vezi toate conturile din platformă, inclusiv master admini, admini de agenție și agenți.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Caută după nume, email, telefon sau agenție..."
                className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/45"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ['all', 'Toți'],
                ['platform_admin', 'Platform admin'],
                ['admin', 'Admini'],
                ['agent', 'Agenți'],
              ] as const).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  onClick={() => setRoleFilter(value)}
                  className={roleFilter === value ? 'border-emerald-300/30 bg-emerald-400/10 text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          {errorMessage ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">{errorMessage}</div>
          ) : null}
          {isLoading ? (
            [...Array(6)].map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl bg-white/10" />)
          ) : filteredUsers.length ? (
            filteredUsers.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-white">{entry.name}</p>
                      <Badge className="border-none bg-white/12 text-white">{ROLE_LABELS[entry.role]}</Badge>
                    </div>
                    <p className="text-sm text-white/62">{entry.agencyName}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-white/70">
                      <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-emerald-200" /> {entry.email}</span>
                      <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-emerald-200" /> {entry.phone}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                    <div className="inline-flex items-center gap-2"><Shield className="h-4 w-4 text-emerald-200" /> ID: {entry.id}</div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              Nu există utilizatori care corespund filtrelor curente.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
