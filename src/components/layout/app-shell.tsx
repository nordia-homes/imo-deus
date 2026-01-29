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
                <Link href="/dashboard" asChild>
                    <SidebarMenuButton tooltip="Dashboard">
                        <BarChart3 />
                        <span>Dashboard</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <Link href="/leads" asChild>
                    <SidebarMenuButton tooltip="Lead-uri">
                        <Users />
                        <span>Lead-uri</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <Link href="/properties" asChild>
                    <SidebarMenuButton tooltip="Proprietăți">
                        <Building2 />
                        <span>Proprietăți</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <Link href="/pipeline" asChild>
                    <SidebarMenuButton tooltip="Pipeline">
                        <Waypoints />
                        <span>Pipeline</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <Link href="/tasks" asChild>
                    <SidebarMenuButton tooltip="Task-uri">
                        <CheckSquare />
                        <span>Task-uri</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <Link href="/contracts" asChild>
                    <SidebarMenuButton tooltip="Contracte">
                        <FileText />
                        <span>Contracte</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <Link href="/ai-assistant" asChild>
                    <SidebarMenuButton tooltip="AI Assistant">
                        <MessageSquare />
                        <span>AI Assistant</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <Link href="/reports" asChild>
                    <SidebarMenuButton tooltip="Rapoarte">
                        <BarChart3 />
                        <span>Rapoarte</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <Link href="/portal-sync" asChild>
                    <SidebarMenuButton tooltip="Integrări">
                        <AppWindow />
                        <span>Integrări</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <Link href="/billing" asChild>
                    <SidebarMenuButton tooltip="Facturare">
                        <CreditCard />
                        <span>Facturare</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <Link href="/settings" asChild>
                    <SidebarMenuButton tooltip="Setări">
                        <Settings />
                        <span>Setări</span>
                    </SidebarMenuButton>
                </Link>
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
