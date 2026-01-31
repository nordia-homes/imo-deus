'use client';

import { useMemo, useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, limit, doc, writeBatch } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { ScrollArea } from '../ui/scroll-area';

export function NotificationBell() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [isOpen, setIsOpen] = useState(false);

    const notificationsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, 'users', user.uid, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(20)
        );
    }, [firestore, user]);

    const { data: notifications, isLoading } = useCollection<Notification>(notificationsQuery);

    const unreadCount = useMemo(() => {
        return notifications?.filter(n => !n.isRead).length ?? 0;
    }, [notifications]);

    const handleMarkAllRead = async () => {
        if (!user || !notifications || unreadCount === 0) return;

        const batch = writeBatch(firestore);
        notifications.forEach(notification => {
            if (!notification.isRead) {
                const notifRef = doc(firestore, 'users', user.uid, 'notifications', notification.id);
                batch.update(notifRef, { isRead: true });
            }
        });

        try {
            await batch.commit();
        } catch (error) {
            console.error("Failed to mark notifications as read:", error);
        }
    };
    
    const handleNotificationClick = (notification: Notification) => {
        if (!user || notification.isRead) return;
        const notifRef = doc(firestore, 'users', user.uid, 'notifications', notification.id);
        updateDocumentNonBlocking(notifRef, { isRead: true });
        setIsOpen(false);
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                    <span className="sr-only">Notificări</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between p-3 border-b">
                    <h3 className="font-semibold">Notificări</h3>
                    <Button variant="link" size="sm" className="h-auto p-0" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
                        <CheckCheck className="mr-1 h-4 w-4" />
                        Marchează tot ca citit
                    </Button>
                </div>
                <ScrollArea className="h-96">
                    <div className="p-2">
                        {isLoading && (
                            <div className="space-y-2 p-2">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        )}
                        {!isLoading && (!notifications || notifications.length === 0) && (
                            <p className="text-center text-sm text-muted-foreground py-10">
                                Nu ai nicio notificare nouă.
                            </p>
                        )}
                        {notifications?.map(notification => (
                            <Link 
                                key={notification.id} 
                                href={notification.link}
                                onClick={() => handleNotificationClick(notification)}
                                className={`block p-3 rounded-lg hover:bg-accent ${!notification.isRead ? 'bg-blue-50/50' : ''}`}
                            >
                                <p className={`text-sm ${!notification.isRead ? 'font-semibold' : ''}`}>
                                    {notification.message}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: ro })}
                                </p>
                            </Link>
                        ))}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
