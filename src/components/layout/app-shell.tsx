import React from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Building2,
  CheckSquare,
  Home,
  Users,
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
              <Link href="/" legacyBehavior passHref>
                <SidebarMenuButton tooltip="Dashboard">
                  <BarChart3 />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/contacts" legacyBehavior passHref>
                <SidebarMenuButton tooltip="Contacts">
                  <Users />
                  <span>Contacts</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/properties" legacyBehavior passHref>
                <SidebarMenuButton tooltip="Properties">
                  <Building2 />
                  <span>Properties</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/tasks" legacyBehavior passHref>
                <SidebarMenuButton tooltip="Tasks">
                  <CheckSquare />
                  <span>Tasks</span>
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
        <header className="flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 sticky top-0 z-30">
            <SidebarTrigger className="md:hidden" />
            <div className='flex-1'>
                {/* Maybe breadcrumbs or page title here later */}
            </div>
            {/* User menu can go here */}
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
