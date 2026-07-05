'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Building2,
  CheckSquare,
  Home,
  Inbox,
  Users,
  MessageSquare,
  CreditCard,
  Settings,
  AppWindow,
  FileText,
  UserCheck,
  UserRound,
  Map,
  Globe,
  CalendarCheck,
  Newspaper,
  BadgeCheck,
  Copyright,
  PhoneCall,
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
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Topbar } from './Topbar'; 
import { useAgency } from '@/context/AgencyContext';
import { BottomNavbar } from './BottomNavbar';
import { ImoDeusTextLogo } from '../icons/ImoDeusTextLogo';
import { PushNotificationsBanner } from '@/components/notifications/PushNotificationsBanner';
import { DemoConversionModal } from '@/components/demo/DemoConversionModal';
import { buildAgencyPublicUrl } from '@/lib/domain-routing';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { agencyId, agency } = useAgency();
  const pathname = usePathname();
  const currentPath = pathname ?? '';
  const showSidebarHeaderTrigger =
    currentPath.startsWith('/leads') ||
    currentPath.startsWith('/properties') ||
    currentPath.startsWith('/sold-properties') ||
    currentPath.startsWith('/inbox');
  const publicWebsiteHref = agencyId
    ? buildAgencyPublicUrl(agency ?? { id: agencyId })
    : null;
  
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="relative h-16 shrink-0">
          <Link href="/dashboard" className="flex h-14 min-w-0 items-center justify-center p-2 group-data-[collapsible=icon]:hidden">
            <div className="group-data-[collapsible=icon]:hidden">
                <ImoDeusTextLogo className="w-44" />
            </div>
          </Link>
          {showSidebarHeaderTrigger ? (
            <SidebarTrigger className="absolute right-2 top-4 h-8 w-8 rounded-xl border border-[var(--app-sidebar-border)] bg-[var(--app-surface-soft)] text-[var(--app-nav-foreground)] hover:bg-[var(--app-nav-hover-bg)] hover:text-[var(--app-nav-hover-foreground)] group-data-[collapsible=icon]:left-1/2 group-data-[collapsible=icon]:right-auto group-data-[collapsible=icon]:-translate-x-1/2" />
          ) : null}
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Dashboard" asChild isActive={currentPath === '/dashboard'}>
                    <Link href="/dashboard">
                        <BarChart3 />
                        <span>Dashboard</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Cumpărători" asChild isActive={currentPath.startsWith('/leads')}>
                    <Link href="/leads">
                        <Users />
                        <span>Cumpărători</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Inbox Storia" asChild isActive={currentPath.startsWith('/inbox')}>
                    <Link href="/inbox">
                        <Inbox />
                        <span>Inbox Storia</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Proprietăți" asChild isActive={currentPath.startsWith('/properties')}>
                    <Link href="/properties">
                        <Building2 />
                        <span>Proprietăți</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Proprietati Vandute" asChild isActive={currentPath.startsWith('/sold-properties')}>
                    <Link href="/sold-properties">
                        <BadgeCheck />
                        <span>Proprietati Vandute</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Anunțuri Proprietari" asChild isActive={currentPath === '/owner-listings'}>
                    <Link href="/owner-listings">
                        <Newspaper />
                        <span>Anunțuri Proprietari</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Apeluri AI" asChild isActive={currentPath.startsWith('/ai-calls')}>
                    <Link href="/ai-calls">
                        <PhoneCall />
                        <span>Apeluri AI</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Hartă" asChild isActive={currentPath === '/map'}>
                    <Link href="/map">
                        <Map />
                        <span>Hartă</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Vizionări" asChild isActive={currentPath === '/viewings'}>
                    <Link href="/viewings">
                        <CalendarCheck />
                        <span>Vizionări</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Task-uri" asChild isActive={currentPath.startsWith('/tasks')}>
                    <Link href="/tasks">
                        <CheckSquare />
                        <span>Task-uri</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Contracte" asChild isActive={currentPath === '/contracts'}>
                    <Link href="/contracts">
                        <FileText />
                        <span>Contracte</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Agenti" asChild isActive={currentPath === '/agenti'}>
                    <Link href="/agenti">
                        <UserRound />
                        <span>Agenti</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="AI Assistant" asChild isActive={currentPath === '/ai-assistant'}>
                    <Link href="/ai-assistant">
                        <MessageSquare />
                        <span>AI Assistant</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Potrivire Proprietăți AI" asChild isActive={currentPath === '/matching'}>
                <Link href="/matching">
                  <UserCheck />
                  <span>Potrivire AI</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Rapoarte" asChild isActive={currentPath === '/reports'}>
                    <Link href="/reports">
                        <BarChart3 />
                        <span>Rapoarte</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Integrări" asChild isActive={currentPath === '/portal-sync'}>
                    <Link href="/portal-sync">
                        <AppWindow />
                        <span>Integrări</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Facturare" asChild isActive={currentPath === '/billing'}>
                    <Link href="/billing">
                        <CreditCard />
                        <span>Facturare</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             {publicWebsiteHref && (
                <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Website Public" asChild>
                        <Link href={publicWebsiteHref} target="_blank" rel="noopener noreferrer">
                            <Globe />
                            <span>Website Public</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
             )}
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Domeniu custom" asChild isActive={currentPath === '/custom-domain'}>
                    <Link href="/custom-domain">
                        <Globe />
                        <span>Domeniu custom</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton tooltip="Setări" asChild isActive={currentPath === '/settings'}>
                    <Link href="/settings">
                        <Settings />
                        <span>Setări</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4 text-center text-xs text-[var(--app-nav-muted)]">
          <p>
            &copy; {new Date().getFullYear()} ImoDeus.ai
          </p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <Topbar />
        <main className="flex-1 [background:var(--app-shell-bg-gradient)] pb-20 lg:pb-0">
            <PushNotificationsBanner />
            {children}
        </main>
        {currentPath !== '/ai-assistant' ? (
          <footer className="hidden border-t border-[var(--app-sidebar-border)] bg-[var(--app-footer-bg)] px-6 py-4 text-sm text-[var(--app-page-muted)] lg:block">
            <div className="flex items-center justify-center gap-2">
              <BadgeCheck className="h-4 w-4 text-[var(--app-highlight-soft)]" />
              <Copyright className="h-4 w-4 text-[var(--app-page-muted)]" />
              <span>2026 Drepturi rezervate ImoDeus</span>
            </div>
          </footer>
        ) : null}
        <DemoConversionModal />
        <BottomNavbar />
      </SidebarInset>
    </SidebarProvider>
  );
}
