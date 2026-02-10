'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck, Users, Building2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/viewings', label: 'Vizionări', icon: CalendarCheck },
  { href: '/leads', label: 'Cumpărători', icon: Users },
  { href: '/properties', label: 'Proprietăți', icon: Building2 },
  { href: '/ai-assistant', label: 'Asistent AI', icon: MessageSquare },
];

export function BottomNavbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-2 left-4 right-4 z-40 h-16 overflow-hidden rounded-2xl border bg-background/80 shadow-2xl backdrop-blur-lg md:hidden">
      <div className="grid h-full grid-cols-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground transition-colors hover:bg-accent/50',
                isActive && 'text-primary font-semibold'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
