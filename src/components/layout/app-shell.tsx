import React from 'react';
import Link from 'next/link';
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
  FileText
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
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Topbar } from './Topbar'; 

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <Home className="text-primary" />
            <h1 className="font-headline text-2xl font-bold text-sidebar-foreground">
              EstateFlow
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
                <SidebarMenuButton tooltip="Lead-uri" asChild>
                  <Link href="/leads">
                    <Users />
                    <span>Lead-uri</span>
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
                <SidebarMenuButton tooltip="Pipeline" asChild>
                  <Link href="/pipeline">
                    <Waypoints />
                    <span>Pipeline</span>
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
            &copy; {new Date().getFullYear()} EstateFlow Inc.
          </p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <Topbar />
        <main className="flex-1 p-4 md:p-6 lg:p-8 bg-background">
            {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
