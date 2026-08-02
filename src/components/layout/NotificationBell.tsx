"use client";

import { Bell, CheckCheck } from 'lucide-react';
import { collection, doc, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { AppNotification } from '@/lib/notifications/types';

function relativeDate(value: AppNotification['createdAt']) {
  const date = typeof value === 'string' ? new Date(value) : value?.toDate?.();
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ro-RO', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

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
      <PopoverContent align="end" className="w-[min(92vw,390px)] p-0">
        <div className="flex items-center justify-between border-b p-3">
          <p className="font-semibold">Notificari</p>
          {unreadCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-8 gap-1 text-xs">
              <CheckCheck className="h-4 w-4" /> Marcheaza toate
            </Button>
          ) : null}
        </div>
        <div className="max-h-[430px] overflow-y-auto">
          {!notifications?.length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nu ai notificari.</p>
          ) : notifications.slice(0, 30).map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => void openNotification(notification)}
              className={`block w-full border-b p-3 text-left transition-colors hover:bg-accent ${notification.isRead ? '' : 'bg-primary/5'}`}
            >
              <span className="flex items-start gap-2">
                {!notification.isRead ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" /> : <span className="w-2" />}
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{notification.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{notification.body}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{relativeDate(notification.createdAt)}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          className="w-full rounded-none"
          onClick={() => {
            setIsOpen(false);
            router.push('/notifications');
          }}
        >
          Vezi toate notificarile
        </Button>
      </PopoverContent>
    </Popover>
  );
}
