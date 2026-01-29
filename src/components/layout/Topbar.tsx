
'use client';
import { Input } from "@/components/ui/input";
import { Bell, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useUser } from "@/context/UserContext";

export function Topbar() {
    const { user } = useUser();
    return (
        <header className="h-16 flex items-center justify-between px-6 bg-white border-b">
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Caută proprietăți, lead-uri..." className="pl-9" />
            </div>
            <div className="flex items-center gap-4">
                <Bell className="h-5 w-5 text-muted-foreground cursor-pointer" />
                 <div className="flex items-center gap-2">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback>{user.name ? user.name.charAt(0) : 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.role}</p>
                    </div>
                </div>
            </div>
        </header>
    );
}
