'use client';

import { brandAssets } from '@/lib/brand-assets';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  Megaphone,
  Facebook,
  UserRoundCog,
  Handshake,
  MailPlus,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Topbar } from './Topbar'; 
import { useAgency } from '@/context/AgencyContext';
import { BottomNavbar } from './BottomNavbar';
import { ImoDeusTextLogo } from '../icons/ImoDeusTextLogo';
import { TikTokIcon } from '../icons/TikTokIcon';
import { PushNotificationsBanner } from '@/components/notifications/PushNotificationsBanner';
import { DemoConversionModal } from '@/components/demo/DemoConversionModal';
import { buildAgencyPublicUrl } from '@/lib/domain-routing';

function InteractiveSidebar({ children }: { children: React.ReactNode }) {
  const { isMobile, setOpen } = useSidebar();
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduledClose = React.useCallback(() => {
    if (!closeTimerRef.current) return;
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  React.useEffect(() => cancelScheduledClose, [cancelScheduledClose]);

  const handleMouseEnter = () => {
    if (isMobile) return;
    cancelScheduledClose();
    setOpen(true);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 140);
  };

  return (
    <Sidebar collapsible="icon" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
    </Sidebar>
  );
}

function SidebarBrand() {
  const { state } = useSidebar();

  if (state === 'collapsed') {
    return (
      <Link
        href="/dashboard"
        aria-label="ImoDeus.ai — pagina principală"
        className="absolute left-1/2 top-2 flex h-12 w-12 -translate-x-1/2 items-center justify-center overflow-hidden rounded-2xl"
      >
        <Image
          src={brandAssets.imodeusSidebar}
          alt=""
          width={44}
          height={44}
          priority
          unoptimized
          className="block h-11 w-11 object-contain"
        />
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard"
      aria-label="ImoDeus.ai — pagina principală"
      className="flex h-14 min-w-0 animate-in items-center justify-center p-2 fade-in-0 slide-in-from-left-2 duration-300 motion-reduce:duration-0"
    >
      <ImoDeusTextLogo className="w-44" />
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { agencyId, agency } = useAgency();
  const pathname = usePathname();
  const currentPath = pathname ?? '';
  const publicWebsiteHref = agencyId
    ? buildAgencyPublicUrl(agency ?? { id: agencyId })
    : null;
  
  return (
    <SidebarProvider defaultOpen={false}>
      <InteractiveSidebar>
        <SidebarHeader className="relative h-16 shrink-0">
          <SidebarBrand />
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
                <SidebarMenuButton tooltip="Marketing" asChild isActive={currentPath.startsWith('/marketing')}>
                    <Link href="/marketing">
                        <Megaphone />
                        <span>Marketing</span>
                    </Link>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={currentPath === '/marketing' || currentPath.startsWith('/marketing/meta-advertising')}>
                      <Link href="/marketing/meta-advertising">
                        <Facebook />
                        <span>Meta Advertising</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={currentPath.startsWith('/marketing/facebook-accounts')}>
                      <Link href="/marketing/facebook-accounts">
                        <UserRoundCog />
                        <span>Conturi Facebook</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={currentPath.startsWith('/marketing/facebook-groups')}>
                      <Link href="/marketing/facebook-groups">
                        <Users />
                        <span>Grupuri Facebook</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={currentPath.startsWith('/marketing/tiktok-ads') || currentPath.startsWith('/marketing/tiktok-studio')}>
                      <Link href="/marketing/tiktok-ads">
                        <TikTokIcon />
                        <span>TikTok</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Gestionare vânzări" asChild isActive={currentPath.startsWith('/sales-management')}>
                    <Link href="/sales-management">
                        <Handshake />
                        <span>Gestionare vânzări</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Gmail" asChild isActive={currentPath.startsWith('/gmail')}>
                    <Link href="/gmail"><MailPlus /><span>Gmail</span></Link>
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
      </InteractiveSidebar>
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
