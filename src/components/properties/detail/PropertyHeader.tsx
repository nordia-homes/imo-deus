'use client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Property } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Edit, FileText, MapPin, MoreHorizontal, Rocket, Send } from "lucide-react";
import { AddPropertyDialog } from "../add-property-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

function getStatusBadgeVariant(status: Property['status']) {
    switch (status) {
        case 'Activ': return 'success';
        case 'Vândut':
        case 'Închiriat':
            return 'destructive';
        case 'Rezervat': return 'warning';
        default: return 'secondary';
    }
}

export function PropertyHeader({ property }: { property: Property }) {
    return (
        <header className="fixed top-16 left-0 md:left-[--sidebar-width-icon] group-data-[collapsible=icon]:md:left-[--sidebar-width-icon] group-data-[state=expanded]:md:left-[--sidebar-width] right-0 z-30 bg-background/95 backdrop-blur-sm border-b transition-all duration-200 ease-linear">
            <div className="flex items-center justify-between p-4 h-24">
                <div className="flex items-center gap-4 overflow-hidden">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-lg shrink-0">
                        {property.title.substring(0, 2)}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-bold truncate">{property.title} - €{property.price.toLocaleString()}</h1>
                            {property.status && <Badge variant={getStatusBadgeVariant(property.status)} className="capitalize shrink-0">{property.status}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-2 truncate">
                            <MapPin className="h-4 w-4 shrink-0" /> {property.address}
                        </p>
                    </div>
                </div>

                <div className="items-center gap-2 hidden md:flex">
                    <Button variant="outline"><Send className="mr-2 h-4 w-4"/> Trimite Clientului</Button>
                    <Button variant="outline"><Rocket className="mr-2 h-4 w-4"/> Publică</Button>
                    <Button variant="outline"><FileText className="mr-2 h-4 w-4"/> Generează PDF</Button>
                    {/* Placeholder for Edit Dialog */}
                    <AddPropertyDialog><Button><Edit className="mr-2 h-4 w-4"/> Editează</Button></AddPropertyDialog>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>Arhivează</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Șterge</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                 <div className="md:hidden">
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem><Send className="mr-2"/> Trimite Clientului</DropdownMenuItem>
                            <DropdownMenuItem><Rocket className="mr-2"/> Publică</DropdownMenuItem>
                            <DropdownMenuItem><FileText className="mr-2"/> Generează PDF</DropdownMenuItem>
                            <DropdownMenuItem><Edit className="mr-2"/> Editează</DropdownMenuItem>
                            <DropdownMenuItem>Arhivează</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Șterge</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}
