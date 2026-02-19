'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Building2,
  CheckSquare,
  Home,
  Users,
  MessageSquare,
  CreditCard,
  Settings,
  AppWindow,
  Waypoints,
  FileText,
  UserCheck,
  Map,
  Globe,
  CalendarCheck,
  Newspaper,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Topbar } from './Topbar'; 
import { useAgency } from '@/context/AgencyContext';
import { BottomNavbar } from './BottomNavbar';
import { ImoDeusTextLogo } from '../icons/ImoDeusTextLogo';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { agencyId } = useAgency();
  const pathname = usePathname();
  
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Link href="/dashboard" className="flex items-center p-2 justify-center group-data-[collapsible=icon]:justify-center h-14">
            <div className="group-data-[collapsible=icon]:hidden">
                <ImoDeusTextLogo className="w-44" />
            </div>
            <Home className="h-7 w-7 text-white hidden group-data-[collapsible=icon]:block" />
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Dashboard" asChild isActive={pathname === '/dashboard'}>
                    <Link href="/dashboard">
                        <BarChart3 />
                        <span>Dashboard</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Cumpărători" asChild isActive={pathname.startsWith('/leads')}>
                    <Link href="/leads">
                        <Users />
                        <span>Cumpărători</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Proprietăți" asChild isActive={pathname.startsWith('/properties')}>
                    <Link href="/properties">
                        <Building2 />
                        <span>Proprietăți</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Anunțuri Proprietari" asChild isActive={pathname === '/owner-listings'}>
                    <Link href="/owner-listings">
                        <Newspaper />
                        <span>Anunțuri Proprietari</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Hartă" asChild isActive={pathname === '/map'}>
                    <Link href="/map">
                        <Map />
                        <span>Hartă</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem className="hidden md:block">
                <SidebarMenuButton tooltip="Pipeline" asChild isActive={pathname === '/pipeline'}>
                    <Link href="/pipeline">
                        <Waypoints />
                        <span>Pipeline</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Vizionări" asChild isActive={pathname === '/viewings'}>
                    <Link href="/viewings">
                        <CalendarCheck />
                        <span>Vizionări</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Task-uri" asChild isActive={pathname.startsWith('/tasks')}>
                    <Link href="/tasks">
                        <CheckSquare />
                        <span>Task-uri</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Contracte" asChild isActive={pathname === '/contracts'}>
                    <Link href="/contracts">
                        <FileText />
                        <span>Contracte</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="AI Assistant" asChild isActive={pathname === '/ai-assistant'}>
                    <Link href="/ai-assistant">
                        <MessageSquare />
                        <span>AI Assistant</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Potrivire Proprietăți AI" asChild isActive={pathname === '/matching'}>
                <Link href="/matching">
                  <UserCheck />
                  <span>Potrivire AI</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Rapoarte" asChild isActive={pathname === '/reports'}>
                    <Link href="/reports">
                        <BarChart3 />
                        <span>Rapoarte</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Integrări" asChild isActive={pathname === '/portal-sync'}>
                    <Link href="/portal-sync">
                        <AppWindow />
                        <span>Integrări</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Facturare" asChild isActive={pathname === '/billing'}>
                    <Link href="/billing">
                        <CreditCard />
                        <span>Facturare</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             {agencyId && (
                <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Website Public" asChild>
                        <Link href={`/agencies/${agencyId}`} target="_blank" rel="noopener noreferrer">
                            <Globe />
                            <span>Website Public</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
             )}
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Setări" asChild isActive={pathname === '/settings'}>
                    <Link href="/settings">
                        <Settings />
                        <span>Setări</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4 text-center text-xs text-sidebar-foreground/60">
          <p>
            &copy; {new Date().getFullYear()} ImoDeus.ai
          </p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <Topbar />
        <main className="flex-1 bg-[#0F1E33] pb-20 lg:pb-0">
            {children}
        </main>
        <BottomNavbar />
      </SidebarInset>
    </SidebarProvider>
  );
}
