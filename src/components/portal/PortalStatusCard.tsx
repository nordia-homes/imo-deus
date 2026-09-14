'use client';

import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';


interface PortalStatusCardProps {
    id?: string;
    name: string;
    connected: boolean;
    lastSync: string;
    listings: number;
    leads: number;
    errors: number;
}
const PORTAL_LOGOS: Record<string, { src: string; alt: string; className: string }> = {
    storia: { src: '/storia-official-logo.svg', alt: 'Storia.ro', className: 'agentfinder-portal-logo agentfinder-portal-logo--storia' },
    publi24: { src: '/publi24-logo.svg', alt: 'Publi24.ro', className: 'agentfinder-portal-logo agentfinder-portal-logo--publi24' },
};

function PortalLogo({ id, name }: { id?: string; name: string }) {
    if (id === 'homezz') {
        return (
            <span className="agentfinder-portal-logo-wordmark agentfinder-portal-logo-wordmark--homezz inline-flex items-baseline text-[1.55rem] font-extrabold leading-none tracking-[-0.045em] text-[#155f55]" aria-label="HomeZZ.ro">
                Home<span className="text-[#27b991]">ZZ</span><small className="ml-0.5 text-xs tracking-normal text-white/60">.ro</small>
            </span>
        );
    }

    if (id === 'trimbitasu') {
        return (
            <span className="agentfinder-portal-logo-wordmark agentfinder-portal-logo-wordmark--trimbitasu inline-flex max-w-full items-center gap-2 rounded-[10px] bg-[#171717] px-2.5 py-2" aria-label="Trîmbițașu.ro">
                <img src="/trimbitasu-logo.png" alt="" aria-hidden="true" className="h-6 w-auto shrink-0 object-contain" />
                <span className="whitespace-nowrap font-serif text-[13px] font-bold leading-none tracking-[0.015em] text-[#f5b914]">TRÎMBIȚAȘU.RO</span>
            </span>
        );
    }

    const logo = id ? PORTAL_LOGOS[id] : undefined;
    return logo ? <img src={logo.src} alt={logo.alt} className={logo.className} /> : <>{name}</>;
}

export default function PortalStatusCard({ id, name, connected, lastSync, listings, leads, errors }: PortalStatusCardProps) {
    return (
        <Card className="agentfinder-integration-card flex h-full flex-col shadow-2xl rounded-2xl bg-[#152A47] border-none text-white">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-white">
                        <PortalLogo id={id} name={name} />
                    </CardTitle>
                    {connected ? (
                        <span className="flex items-center text-sm text-green-400"><CheckCircle2 className="h-4 w-4 mr-1" /> Conectat</span>
                    ) : (
                        <span className="flex items-center text-sm text-red-500"><XCircle className="h-4 w-4 mr-1" /> Deconectat</span>
                    )}
                </div>
                 <CardDescription className="text-white/70">Ultima sincronizare: {lastSync}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-2">
                <div className="text-sm flex justify-between">
                    <span className="text-white/70">Anunțuri sincronizate:</span>
                    <span className="font-medium">{listings}</span>
                </div>
                 <div className="text-sm flex justify-between">
                    <span className="text-white/70">Lead-uri primite:</span>
                    <span className="font-medium">{leads}</span>
                </div>
                {errors > 0 && (
                     <div className="text-sm flex justify-between text-destructive">
                        <span className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Erori la sincronizare:</span>
                        <span className="font-medium">{errors}</span>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                <Button variant="outline" className="w-full bg-white/10 border-white/20 hover:bg-white/20 text-white">
                    {connected ? 'Vezi Setări' : 'Conectează'}
                </Button>
            </CardFooter>
        </Card>
    )
}
