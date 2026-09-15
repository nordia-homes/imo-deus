'use client';
import { LogOut, Search, Users, Building2, CheckSquare, Loader2, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '../ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import React, { useState, useEffect, useRef } from 'react';
import type { Contact, Property, Task } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStoredRuntimeMode } from '@/lib/runtime-mode';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { unregisterPushNotifications } from '@/lib/push-notifications';
import { useFirebaseApp, useFirestore } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useAgency } from '@/context/AgencyContext';
import { SidebarTrigger } from '@/components/ui/sidebar';

function normalizeSearchText(value?: string | null) {
    return (value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('ro')
        .replace(/\s+/g, ' ')
        .trim();
}

function matchesSearch(parts: Array<string | number | null | undefined>, query: string) {
    const searchableText = normalizeSearchText(parts.filter((part) => part !== null && part !== undefined).join(' '));
    return query.split(/\s+/).every((token) => searchableText.includes(token));
}

type SearchSourceCache = {
    agencyId: string;
    loadedAt: number;
    contacts: Contact[];
    properties: Property[];
    tasks: Task[];
};

export function Topbar() {
    const auth = useAuth();
    const firebaseApp = useFirebaseApp();
    const firestore = useFirestore();
    const { agencyId } = useAgency();
    const router = useRouter();
    const { user } = useUser();

    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [results, setResults] = useState<{
        contacts: Pick<Contact, 'id' | 'name'>[],
        properties: Pick<Property, 'id' | 'title'>[],
        tasks: Pick<Task, 'id' | 'description'>[],
    }>({ contacts: [], properties: [], tasks: [] });
    const [isSearching, setIsSearching] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [isDemoMode, setIsDemoMode] = useState(false);
    const latestQueryRef = useRef('');
    const searchSourceCacheRef = useRef<SearchSourceCache | null>(null);

    useEffect(() => {
        setIsDemoMode(getStoredRuntimeMode() === 'demo');
    }, []);

    // Keep typing fluid and only update remote results after the user pauses.
    useEffect(() => {
        const normalizedQuery = normalizeSearchText(query);
        if (normalizedQuery.length < 2) {
            setIsPopoverOpen(false);
            setIsSearching(false);
            setResults({ contacts: [], properties: [], tasks: [] });
        }

        const handler = setTimeout(() => {
            setDebouncedQuery(normalizedQuery);
        }, 600);

        return () => {
            clearTimeout(handler);
        };
    }, [query]);

    // Perform search when debounced query changes
    useEffect(() => {
        if (debouncedQuery.length < 2) {
            setResults({ contacts: [], properties: [], tasks: [] });
            setIsSearching(false);
            return;
        }

        if (!user || !agencyId) {
            setResults({ contacts: [], properties: [], tasks: [] });
            setIsSearching(false);
            return;
        }

        const activeAgencyId = agencyId;
        let isCancelled = false;
        setIsSearching(true);

        async function search() {
            try {
                let source = searchSourceCacheRef.current;
                const cacheIsFresh = source
                    && source.agencyId === agencyId
                    && Date.now() - source.loadedAt < 60_000;

                if (!cacheIsFresh) {
                    const agencyPath = ['agencies', activeAgencyId] as const;
                    const [contactsSnapshot, propertiesSnapshot, tasksSnapshot] = await Promise.all([
                        getDocs(collection(firestore, ...agencyPath, 'contacts')),
                        getDocs(collection(firestore, ...agencyPath, 'properties')),
                        getDocs(collection(firestore, ...agencyPath, 'tasks')),
                    ]);

                    source = {
                        agencyId: activeAgencyId,
                        loadedAt: Date.now(),
                        contacts: contactsSnapshot.docs.map((snapshot) => ({ ...(snapshot.data() as Contact), id: snapshot.id })),
                        properties: propertiesSnapshot.docs.map((snapshot) => ({ ...(snapshot.data() as Property), id: snapshot.id })),
                        tasks: tasksSnapshot.docs.map((snapshot) => ({ ...(snapshot.data() as Task), id: snapshot.id })),
                    };
                    searchSourceCacheRef.current = source;
                }

                if (isCancelled || normalizeSearchText(latestQueryRef.current) !== debouncedQuery || !source) return;

                setResults({
                    contacts: source.contacts
                        .filter((contact) => matchesSearch([
                            contact.name,
                            contact.email,
                            contact.phone,
                            contact.status,
                            contact.source,
                        ], debouncedQuery))
                        .slice(0, 6)
                        .map(({ id, name }) => ({ id, name })),
                    properties: source.properties
                        .filter((property) => matchesSearch([
                            property.title,
                            property.address,
                            property.location,
                            property.city,
                            property.zone,
                            property.propertyType,
                            property.transactionType,
                            property.ownerName,
                            property.agentName,
                        ], debouncedQuery))
                        .slice(0, 6)
                        .map(({ id, title }) => ({ id, title })),
                    tasks: source.tasks
                        .filter((task) => matchesSearch([
                            task.description,
                            task.contactName,
                            task.propertyTitle,
                            task.agentName,
                        ], debouncedQuery))
                        .slice(0, 6)
                        .map(({ id, description }) => ({ id, description })),
                });
            } catch (error) {
                if (isCancelled || normalizeSearchText(latestQueryRef.current) !== debouncedQuery) return;
                console.error('Global search failed:', error);
                setResults({ contacts: [], properties: [], tasks: [] });
            } finally {
                if (!isCancelled && normalizeSearchText(latestQueryRef.current) === debouncedQuery) {
                    setIsSearching(false);
                }
            }
        }

        void search();

        return () => {
            isCancelled = true;
        };
    }, [agencyId, debouncedQuery, firestore, user]);

    const getInitials = (name?: string | null) => {
        if (!name) return 'U';
        const nameParts = name.split(' ');
        if (nameParts.length > 1) {
            return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
    
    const handleSelect = () => {
        setIsPopoverOpen(false);
        setQuery('');
        latestQueryRef.current = '';
    }
    
    const handleLogout = async () => {
        if (user) {
            await unregisterPushNotifications({ firebaseApp, user }).catch((error) => {
                console.warn('Notification device cleanup failed during logout:', error);
            });
        }
        await signOut(auth);
        router.push('/login');
    }

    const hasResults = results.contacts.length > 0 || results.properties.length > 0 || results.tasks.length > 0;

    return (
        <header className="agentfinder-topbar sticky top-0 z-30 flex h-16 min-w-0 w-full items-center gap-3 overflow-hidden border-b border-[var(--app-sidebar-border)] bg-[var(--app-topbar-bg)] px-3 text-[var(--app-page-foreground)] backdrop-blur-xl md:px-6">
            <SidebarTrigger
                aria-label="Deschide meniul"
                className="h-10 w-10 shrink-0 rounded-xl border border-[var(--app-sidebar-border)] bg-[var(--app-surface-input)] text-[var(--app-page-foreground)] shadow-sm hover:bg-[var(--app-nav-hover-bg)] md:hidden"
            />
            <div className="min-w-0 flex-1">
                <Popover
                    open={isPopoverOpen}
                    onOpenChange={(open) => setIsPopoverOpen(open && query.trim().length >= 2)}
                >
                    <PopoverTrigger asChild>
                        <div className="relative min-w-0 w-full">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--app-page-muted)]" />
                            <Input
                                type="search"
                                placeholder="Caută lead-uri, proprietăți..."
                                className="w-full min-w-0 rounded-lg border-none bg-[var(--app-surface-input)] pl-8 text-[var(--app-page-foreground)] placeholder:text-[var(--app-page-muted)] md:w-[280px] lg:w-[320px]"
                                value={query}
                                onChange={(event) => {
                                    const nextQuery = event.target.value;
                                    const canSearch = nextQuery.trim().length >= 2;
                                    latestQueryRef.current = nextQuery;
                                    setQuery(nextQuery);
                                    setIsSearching(canSearch);
                                    setIsPopoverOpen(canSearch);
                                }}
                                onFocus={() => {
                                    if (query.trim().length >= 2) setIsPopoverOpen(true);
                                }}
                                aria-label="Caută în lead-uri, proprietăți și task-uri"
                            />
                        </div>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-[min(320px,calc(100vw-1.5rem))] p-0"
                        align="start"
                        onOpenAutoFocus={(event) => event.preventDefault()}
                    >
                        <div className="p-2 max-h-[400px] overflow-y-auto">
                            {isSearching && (
                                <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    <span>Se caută...</span>
                                </div>
                            )}
                            {!isSearching && debouncedQuery.length > 1 && !hasResults && (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    Niciun rezultat găsit.
                                </div>
                            )}
                            {!isSearching && hasResults && (
                                <div className="space-y-2">
                                    {results.contacts.length > 0 && (
                                        <div>
                                            <h4 className="px-2 text-xs font-semibold text-muted-foreground">Lead-uri</h4>
                                            <div className="mt-1 space-y-1">
                                                {results.contacts.map(contact => (
                                                    <Link key={contact.id} href={`/leads/${contact.id}`} onClick={handleSelect} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent text-sm">
                                                        <Users className="h-4 w-4 text-muted-foreground" />
                                                        <span>{contact.name}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {results.properties.length > 0 && (
                                        <div>
                                            <h4 className="px-2 text-xs font-semibold text-muted-foreground">Proprietăți</h4>
                                            <div className="mt-1 space-y-1">
                                                {results.properties.map(property => (
                                                    <Link key={property.id} href={`/properties/${property.id}`} onClick={handleSelect} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent text-sm">
                                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                                        <span className="truncate">{property.title}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {results.tasks.length > 0 && (
                                        <div>
                                            <h4 className="px-2 text-xs font-semibold text-muted-foreground">Task-uri</h4>
                                            <div className="mt-1 space-y-1">
                                                {results.tasks.map(task => (
                                                    <Link key={task.id} href={`/tasks`} onClick={handleSelect} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent text-sm">
                                                        <CheckSquare className="h-4 w-4 text-muted-foreground" />
                                                        <span className="truncate">{task.description}</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            <div className='flex shrink-0 items-center gap-3'>
                 {isDemoMode ? (
                    <Button asChild variant="outline" className="hidden rounded-full border-[var(--app-surface-border)] bg-[var(--app-surface-soft)] text-[var(--app-page-foreground)] hover:bg-[var(--app-nav-hover-bg)] md:inline-flex">
                        <Link href="/demo/exit">
                            <ShieldCheck className="h-4 w-4" />
                            Iesire demo
                        </Link>
                    </Button>
                 ) : null}
                 <NotificationBell />
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="flex items-center gap-2 p-1 h-auto rounded-full hover:bg-[var(--app-nav-hover-bg)]">
                            <Avatar className="cursor-pointer h-8 w-8">
                                <AvatarImage src={user?.photoURL || undefined} />
                                <AvatarFallback className="bg-muted text-foreground">{getInitials(user?.displayName || user?.email)}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {isDemoMode ? (
                            <DropdownMenuItem asChild>
                                <Link href="/demo/exit">
                                    <ShieldCheck className="mr-2 h-4 w-4" />
                                    <span>Iesire demo</span>
                                </Link>
                            </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Deconectare</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
