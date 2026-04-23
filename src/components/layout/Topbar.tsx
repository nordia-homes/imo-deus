'use client';
import { LogOut, Search, Users, Building2, CheckSquare, Loader2, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '../ui/input';
import { SidebarTrigger } from '../ui/sidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useUser, useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import React, { useState, useEffect } from 'react';
import { collection } from 'firebase/firestore';
import type { Contact, Property, Task } from '@/lib/types';
import Link from 'next/link';
import { useAgency } from '@/context/AgencyContext';
import { useRouter } from 'next/navigation';
import { LogoIcon } from '../icons/LogoIcon';
import { getStoredRuntimeMode } from '@/lib/runtime-mode';

export function Topbar() {
    const auth = useAuth();
    const router = useRouter();
    const { user } = useUser();
    const { agencyId } = useAgency();
    const firestore = useFirestore();

    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [results, setResults] = useState<{ contacts: Contact[], properties: Property[], tasks: Task[] }>({ contacts: [], properties: [], tasks: [] });
    const [isSearching, setIsSearching] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [isDemoMode, setIsDemoMode] = useState(false);

    useEffect(() => {
        setIsDemoMode(getStoredRuntimeMode() === 'demo');
    }, []);

    // Fetch all data for client-side search
    const contactsQuery = useMemoFirebase(() => agencyId ? collection(firestore, 'agencies', agencyId, 'contacts') : null, [firestore, agencyId]);
    const { data: contacts } = useCollection<Contact>(contactsQuery);

    const propertiesQuery = useMemoFirebase(() => agencyId ? collection(firestore, 'agencies', agencyId, 'properties') : null, [firestore, agencyId]);
    const { data: properties } = useCollection<Property>(propertiesQuery);

    const tasksQuery = useMemoFirebase(() => agencyId ? collection(firestore, 'agencies', agencyId, 'tasks') : null, [firestore, agencyId]);
    const { data: tasks } = useCollection<Task>(tasksQuery);
    
    // Debounce search query
    useEffect(() => {
        setIsSearching(true);
        if (query.length > 0) {
            setIsPopoverOpen(true);
        } else {
            setIsPopoverOpen(false);
        }
        const handler = setTimeout(() => {
            setDebouncedQuery(query);
        }, 300);

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

        const lowerCaseQuery = debouncedQuery.toLowerCase();

        const filteredContacts = contacts?.filter(c =>
            c.name.toLowerCase().includes(lowerCaseQuery) ||
            c.email.toLowerCase().includes(lowerCaseQuery)
        ) || [];

        const filteredProperties = properties?.filter(p =>
            (p.title && p.title.toLowerCase().includes(lowerCaseQuery)) ||
            (p.address && p.address.toLowerCase().includes(lowerCaseQuery))
        ) || [];

        const filteredTasks = tasks?.filter(t =>
            t.description.toLowerCase().includes(lowerCaseQuery)
        ) || [];

        setResults({
            contacts: filteredContacts.slice(0, 5), // Limit results
            properties: filteredProperties.slice(0, 5),
            tasks: filteredTasks.slice(0, 5)
        });
        setIsSearching(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQuery, contacts, properties, tasks]);

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
    }
    
    const handleLogout = () => {
        signOut(auth).then(() => {
            router.push('/login');
        });
    }

    const hasResults = results.contacts.length > 0 || results.properties.length > 0 || results.tasks.length > 0;

    return (
        <header className="agentfinder-topbar sticky top-0 z-30 flex h-16 min-w-0 w-full items-center gap-3 overflow-hidden border-b border-[var(--app-sidebar-border)] bg-[var(--app-topbar-bg)] px-3 text-[var(--app-page-foreground)] backdrop-blur-xl md:px-6">
            
            <div className="flex shrink-0 items-center gap-3">
                {/* Sidebar trigger for all screen sizes */}
                <SidebarTrigger />
            </div>


            <div className="min-w-0 flex-1">
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                        <div className="relative min-w-0 w-full">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--app-page-muted)]" />
                            <Input
                                type="search"
                                placeholder="Caută lead-uri, proprietăți..."
                                className="w-full min-w-0 rounded-lg border-none bg-[var(--app-surface-input)] pl-8 text-[var(--app-page-foreground)] placeholder:text-[var(--app-page-muted)] md:w-[280px] lg:w-[320px]"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
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
