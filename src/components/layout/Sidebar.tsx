'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Building2, KanbanSquare, CheckSquare, Bot, CreditCard, Share2, Settings, LogOut, BarChart3 } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { cn } from '@/lib/utils';


const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { href: '/leads', label: 'Lead-uri', icon: Users },
    { href: '/properties', label: 'Proprietăți', icon: Building2 },
    { href: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
    { href: '/tasks', label: 'Task-uri', icon: CheckSquare },
    { href: '/ai-assistant', label: 'AI Assistant', icon: Bot },
    { href: '/billing', label: 'Facturare', icon: CreditCard },
    { href: '/portal-sync', label: 'Integrări', icon: Share2 },
    { href: '/settings', label: 'Setări', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const { agency } = useAgency();

    return (
        <aside className="w-64 flex-shrink-0 bg-gray-800 text-white flex flex-col">
            <div className="h-16 flex items-center justify-center px-4 border-b border-gray-700">
                 {agency.logoUrl ? (
                    <img src={agency.logoUrl} alt={agency.name} className="h-8 max-w-full" />
                 ) : (
                    <div className="flex items-center gap-2">
                        <Home className="h-8 w-8" style={{ color: agency.primaryColor || '#FFFFFF' }}/>
                        <h1 className="text-xl font-headline font-bold">{agency.name || 'EstateFlow'}</h1>
                    </div>
                 )}
            </div>
            <nav className="flex-1 px-2 py-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                isActive ? "bg-gray-900 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"
                            )}
                            style={isActive ? { backgroundColor: agency.primaryColor || '#111827' } : {}}
                        >
                            <item.icon className="mr-3 h-5 w-5" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
            <div className="px-2 py-4 border-t border-gray-700">
                <Link href="/login" className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white">
                    <LogOut className="mr-3 h-5 w-5" />
                    Deconectare
                </Link>
            </div>
        </aside>
    );
}
