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
import { LogoIcon } from '../icons/LogoIcon';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { agencyId } = useAgency();
  const pathname = usePathname();
  
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <LogoIcon className="h-7 w-7 text-primary" />
            <h1 className="font-headline text-2xl font-bold text-sidebar-foreground">
              <span>Imoflux</span><span className="text-success">.ai</span>
            </h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Dashboard" asChild>
                    <Link href="/dashboard">
                        <BarChart3 />
                        <span>Dashboard</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Cumpărători" asChild>
                    <Link href="/leads">
                        <Users />
                        <span>Cumpărători</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Proprietăți" asChild>
                    <Link href="/properties">
                        <Building2 />
                        <span>Proprietăți</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Anunțuri Proprietari" asChild>
                    <Link href="/owner-listings">
                        <Newspaper />
                        <span>Anunțuri Proprietari</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Hartă" asChild>
                    <Link href="/map">
                        <Map />
                        <span>Hartă</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Pipeline" asChild>
                    <Link href="/pipeline">
                        <Waypoints />
                        <span>Pipeline</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Vizionări" asChild>
                    <Link href="/viewings">
                        <CalendarCheck />
                        <span>Vizionări</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Task-uri" asChild>
                    <Link href="/tasks">
                        <CheckSquare />
                        <span>Task-uri</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Contracte" asChild>
                    <Link href="/contracts">
                        <FileText />
                        <span>Contracte</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="AI Assistant" asChild>
                    <Link href="/ai-assistant">
                        <MessageSquare />
                        <span>AI Assistant</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Potrivire Proprietăți AI" asChild>
                <Link href="/matching">
                  <UserCheck />
                  <span>Potrivire AI</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Rapoarte" asChild>
                    <Link href="/reports">
                        <BarChart3 />
                        <span>Rapoarte</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Integrări" asChild>
                    <Link href="/portal-sync">
                        <AppWindow />
                        <span>Integrări</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Facturare" asChild>
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
                <SidebarMenuButton tooltip="Setări" asChild>
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
            &copy; {new Date().getFullYear()} Imoflux.ai Inc.
          </p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <Topbar />
        <main className={cn(
          "flex-1 bg-background px-0 pt-0 pb-20 lg:p-6 lg:pb-6",
          (pathname === '/dashboard' || pathname === '/leads' || pathname === '/properties') && "bg-[#0F1E33] lg:bg-background"
        )}>
            {children}
        </main>
        <BottomNavbar />
      </SidebarInset>
    </SidebarProvider>
  );
}
