"use client";

import { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { collection, doc, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { AppNotification } from '@/lib/notifications/types';

function dateLabel(value: AppNotification['createdAt']) {
  const date = typeof value === 'string' ? new Date(value) : value?.toDate?.();
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '';
}

export default function NotificationsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [pageSize, setPageSize] = useState(100);
  const notificationsQuery = useMemoFirebase(() => user ? query(
    collection(firestore, 'users', user.uid, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  ) : null, [firestore, pageSize, user]);
  const { data, isLoading } = useCollection<AppNotification>(notificationsQuery);
  const notifications = (data || []).filter((item) => !onlyUnread || !item.isRead);

  const open = async (item: AppNotification) => {
    if (!user) return;
    if (!item.isRead) await updateDoc(doc(firestore, 'users', user.uid, 'notifications', item.id), {
      isRead: true, readAt: serverTimestamp(),
    });
    router.push(item.actionUrl || '/dashboard');
  };

  const markAll = async () => {
    if (!user) return;
    const token = await user.getIdToken();
    await fetch('/api/notifications/read-all', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notificari</h1>
          <p className="text-sm text-muted-foreground">Istoricul evenimentelor importante din agentie.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={onlyUnread ? 'default' : 'outline'} onClick={() => setOnlyUnread((value) => !value)}>Doar necitite</Button>
          <Button variant="outline" onClick={markAll}><CheckCheck className="mr-2 h-4 w-4" />Marcheaza toate</Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Inbox</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <p className="p-8 text-center text-muted-foreground">Se incarca...</p> : null}
          {!isLoading && notifications.length === 0 ? <p className="p-8 text-center text-muted-foreground">Nu exista notificari.</p> : null}
          {notifications.map((item) => (
            <button key={item.id} type="button" onClick={() => void open(item)} className={`block w-full border-t p-4 text-left hover:bg-accent ${item.isRead ? '' : 'bg-primary/5'}`}>
              <span className="flex items-start gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.isRead ? 'bg-muted' : 'bg-primary'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{item.body}</span>
                  <span className="mt-2 block text-xs text-muted-foreground">{dateLabel(item.createdAt)}</span>
                </span>
              </span>
            </button>
          ))}
          {data?.length === pageSize ? (
            <div className="border-t p-4 text-center">
              <Button variant="outline" onClick={() => setPageSize((value) => value + 100)}>Incarca notificari mai vechi</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
