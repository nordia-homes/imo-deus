"use client";

import { ArrowUpRight, Bell, BellRing, CheckCheck, Sparkles } from 'lucide-react';
import { collection, doc, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { AppNotification } from '@/lib/notifications/types';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const notificationsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(100),
    );
  }, [firestore, user]);
  const { data: notifications } = useCollection<AppNotification>(notificationsQuery);
  const unreadCount = notifications?.filter((item) => !item.isRead).length || 0;
  const recentNotifications = notifications?.slice(0, 8) || [];

  const openNotification = async (notification: AppNotification) => {
    if (!user) return;
    setIsOpen(false);
    if (!notification.isRead) {
      await updateDoc(doc(firestore, 'users', user.uid, 'notifications', notification.id), {
        isRead: true,
        readAt: serverTimestamp(),
      }).catch((error) => console.error('Notification read update failed:', error));
    }
    router.push(notification.actionUrl || '/notifications');
  };

  const markAllRead = async () => {
    if (!user) return;
    const token = await user.getIdToken();
    await fetch('/api/notifications/read-all', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notificari">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        className="w-[min(calc(100vw-1rem),440px)] overflow-hidden rounded-[28px] border border-white/70 bg-background/95 p-0 shadow-[0_28px_90px_-34px_rgba(15,35,61,0.55)] backdrop-blur-2xl dark:border-white/10"
      >
        <div className="notification-dark-header relative overflow-hidden border-b border-white/10 bg-[#10233d] px-4 py-3 text-white sm:px-5 sm:py-5">
          <span className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-emerald-400/25 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-16 left-12 h-36 w-36 rounded-full bg-violet-400/25 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-[0_12px_30px_-12px_rgba(52,211,153,0.7)] backdrop-blur sm:h-12 sm:w-12 sm:rounded-2xl">
                <BellRing className="h-5 w-5 text-emerald-100 sm:h-6 sm:w-6" />
              </span>
              <span>
                <span className="notification-on-dark-accent hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100 sm:flex">
                  <Sparkles className="h-3.5 w-3.5" /> Centru de activitate
                </span>
                <span className="notification-on-dark-primary block text-lg font-bold tracking-tight text-white sm:mt-1 sm:text-xl">Notificări</span>
                <span className="notification-on-dark-muted mt-0.5 block text-[11px] text-white/75 sm:text-xs">
                  {unreadCount ? `${unreadCount} noi` : 'Ești la zi'}
                </span>
              </span>
            </div>
            {unreadCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void markAllRead()}
                className="h-8 w-8 shrink-0 gap-1.5 rounded-full border border-white/15 bg-white/10 px-0 text-[11px] text-white hover:bg-white/20 hover:text-white sm:h-9 sm:w-auto sm:px-3"
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Citește toate</span>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="max-h-[min(62vh,560px)] space-y-2 overflow-y-auto bg-gradient-to-b from-muted/35 via-background to-background p-3">
          {!recentNotifications.length ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-emerald-400/15 to-violet-400/15 ring-1 ring-primary/10">
                <Bell className="h-7 w-7 text-primary/70" />
              </span>
              <p className="mt-4 font-semibold">Totul este liniștit</p>
              <p className="mt-1 max-w-[250px] text-xs leading-relaxed text-muted-foreground">Noile activități importante din agenție vor apărea aici.</p>
            </div>
          ) : recentNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              item={notification}
              compact
              onOpen={(item) => void openNotification(item)}
            />
          ))}
        </div>

        <div className="border-t bg-background/90 p-3">
          <Button
            variant="ghost"
            className="group h-12 w-full justify-between rounded-2xl bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-violet-500/10 px-4 font-semibold text-foreground hover:from-emerald-500/15 hover:via-cyan-500/15 hover:to-violet-500/15"
            onClick={() => {
              setIsOpen(false);
              router.push('/notifications');
            }}
          >
            <span>Deschide centrul de notificări</span>
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
