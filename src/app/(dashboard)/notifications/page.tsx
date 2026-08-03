"use client";

import { useState } from 'react';
import { BellRing, CheckCheck, Filter, Inbox, Sparkles } from 'lucide-react';
import { collection, doc, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  isNotificationToday,
  NotificationItem,
} from '@/components/notifications/NotificationItem';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { AppNotification } from '@/lib/notifications/types';

export default function NotificationsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [pageSize, setPageSize] = useState(100);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const notificationsQuery = useMemoFirebase(() => user ? query(
    collection(firestore, 'users', user.uid, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  ) : null, [firestore, pageSize, user]);
  const { data, isLoading } = useCollection<AppNotification>(notificationsQuery);
  const allNotifications = data || [];
  const notifications = allNotifications.filter((item) => !onlyUnread || !item.isRead);
  const unreadCount = allNotifications.filter((item) => !item.isRead).length;
  const todayCount = allNotifications.filter((item) => isNotificationToday(item.createdAt)).length;

  const open = async (item: AppNotification) => {
    if (!user) return;
    if (!item.isRead) await updateDoc(doc(firestore, 'users', user.uid, 'notifications', item.id), {
      isRead: true, readAt: serverTimestamp(),
    });
    router.push(item.actionUrl || '/dashboard');
  };

  const markAll = async () => {
    if (!user) return;
    setIsMarkingAll(true);
    try {
      const token = await user.getIdToken();
      await fetch('/api/notifications/read-all', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3 p-3 pb-28 sm:space-y-5 md:p-6 md:pb-10">
      <section className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#10233d] px-4 py-4 text-white shadow-[0_30px_80px_-42px_rgba(15,35,61,0.85)] sm:rounded-[32px] sm:px-7 sm:py-7">
        <span className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="relative grid gap-4 sm:gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <span className="hidden items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100 sm:inline-flex">
              <Sparkles className="h-3.5 w-3.5" /> Fluxul agenției
            </span>
            <div className="flex items-center gap-3 sm:mt-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/20 bg-white/10 shadow-[0_16px_35px_-16px_rgba(52,211,153,0.8)] backdrop-blur sm:h-14 sm:w-14 sm:rounded-[20px]">
                <BellRing className="h-5 w-5 text-emerald-100 sm:h-7 sm:w-7" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">Notificări</h1>
                <p className="mt-1 hidden text-sm text-white/70 sm:block">Activitatea importantă a agenției, într-un singur loc.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            <div className="min-w-0 rounded-xl border border-white/15 bg-white/[0.08] px-2.5 py-2 backdrop-blur sm:min-w-[112px] sm:rounded-2xl sm:px-4 sm:py-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/65 sm:text-[10px] sm:tracking-[0.16em]">Total</p>
              <p className="mt-0.5 text-xl font-bold text-white sm:mt-1 sm:text-2xl">{allNotifications.length}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-2 backdrop-blur sm:min-w-[112px] sm:rounded-2xl sm:px-4 sm:py-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-100/80 sm:text-[10px] sm:tracking-[0.16em]">Noi</p>
              <p className="mt-0.5 text-xl font-bold text-emerald-100 sm:mt-1 sm:text-2xl">{unreadCount}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-violet-300/25 bg-violet-300/10 px-2.5 py-2 backdrop-blur sm:min-w-[112px] sm:rounded-2xl sm:px-4 sm:py-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-violet-100/80 sm:text-[10px] sm:tracking-[0.16em]">Astăzi</p>
              <p className="mt-0.5 text-xl font-bold text-violet-100 sm:mt-1 sm:text-2xl">{todayCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-border/60 bg-background/75 shadow-[0_22px_70px_-45px_rgba(15,35,61,0.5)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 border-b bg-gradient-to-r from-emerald-500/[0.06] via-transparent to-violet-500/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Inbox className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold">Inbox activitate</h2>
              <p className="text-xs text-muted-foreground">{notifications.length} {notifications.length === 1 ? 'notificare afișată' : 'notificări afișate'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={onlyUnread ? 'default' : 'outline'}
              onClick={() => setOnlyUnread((value) => !value)}
              className="h-10 gap-2 rounded-full px-4"
            >
              <Filter className="h-4 w-4" />
              {onlyUnread ? 'Afișează toate' : 'Doar necitite'}
            </Button>
            <Button
              variant="outline"
              onClick={() => void markAll()}
              disabled={!unreadCount || isMarkingAll}
              className="h-10 gap-2 rounded-full px-4"
            >
              <CheckCheck className="h-4 w-4" />
              {isMarkingAll ? 'Se actualizează...' : 'Marchează toate'}
            </Button>
          </div>
        </div>

        <div className="space-y-2 bg-gradient-to-b from-muted/25 via-background to-background p-2 sm:space-y-3 sm:p-4">
          {isLoading ? Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex animate-pulse gap-4 rounded-[24px] border border-border/50 bg-background/70 p-4">
              <span className="h-14 w-14 shrink-0 rounded-2xl bg-muted" />
              <span className="flex-1 space-y-2 py-1">
                <span className="block h-3 w-24 rounded-full bg-muted" />
                <span className="block h-4 w-1/2 rounded-full bg-muted" />
                <span className="block h-3 w-4/5 rounded-full bg-muted" />
              </span>
            </div>
          )) : null}

          {!isLoading && notifications.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-emerald-400/15 via-cyan-400/10 to-violet-400/15 ring-1 ring-primary/10 shadow-lg">
                <BellRing className="h-9 w-9 text-primary/70" />
              </span>
              <h3 className="mt-5 text-lg font-bold">{onlyUnread ? 'Ai citit tot' : 'Inboxul este pregătit'}</h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {onlyUnread ? 'Nu mai există notificări necitite. Poți reveni la istoricul complet.' : 'Evenimentele importante din agenție vor apărea aici, ordonate cronologic.'}
              </p>
              {onlyUnread ? <Button variant="outline" className="mt-5 rounded-full" onClick={() => setOnlyUnread(false)}>Vezi istoricul complet</Button> : null}
            </div>
          ) : null}

          {notifications.map((item) => (
            <NotificationItem key={item.id} item={item} onOpen={(notification) => void open(notification)} />
          ))}

          {data?.length === pageSize ? (
            <div className="pt-2 text-center">
              <Button variant="outline" className="rounded-full px-6" onClick={() => setPageSize((value) => value + 100)}>Încarcă notificări mai vechi</Button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
