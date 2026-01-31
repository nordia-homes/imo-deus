'use client';
import { LogOut, Search, Users, Building2, CheckSquare, Loader2 } from 'lucide-react';
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

    const getInitials = (email?: string | null) => {
        if (!email) return 'U';
        return email.substring(0, 2).toUpperCase();
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
        <header className="flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="flex-1">
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Caută lead-uri, proprietăți, task-uri..."
                                className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
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
            <div className='flex items-center gap-4'>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Avatar className="cursor-pointer">
                            <AvatarImage src={user?.photoURL || undefined} />
                            <AvatarFallback>{getInitials(user?.email)}</AvatarFallback>
                        </Avatar>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
