'use client';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone } from "lucide-react";
import { WhatsappIcon } from "@/components/icons/WhatsappIcon";
import { cn } from "@/lib/utils";
import { ACTION_CARD_CLASSNAME, ACTION_PILL_CLASSNAME } from "./cardStyles";

type AgentInfo = {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
}

export function AgentCard({ agent, isMobile }: { agent: AgentInfo, isMobile?: boolean }) {
    const getInitials = (name?: string | null) => {
        if (!name) return 'A';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    
    const sanitizeForWhatsapp = (phone?: string | null) => {
        if (!phone) return '';
        let sanitized = phone.replace(/\D/g, '');
        if (sanitized.length === 10 && sanitized.startsWith('07')) {
            return `40${sanitized.substring(1)}`;
        }
        return sanitized;
    };
    const sanitizedPhone = sanitizeForWhatsapp(agent.phone);

    if (isMobile) {
        return (
            <Card className="bg-white/10 text-white border-none rounded-lg">
                <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                         <Avatar className="h-10 w-10">
                            <AvatarImage src={agent.avatarUrl || undefined} alt={agent.name || 'Agent'}/>
                            <AvatarFallback className="bg-white/20">{getInitials(agent.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-xs text-white/70">Agent:</p>
                            <p className="text-sm font-semibold">{agent.name}</p>
                            {agent.phone && <p className="text-xs text-white/70">{agent.phone}</p>}
                        </div>
                    </div>
                    <div className="flex items-center">
                        {agent.phone && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80" asChild>
                                <a href={`tel:${agent.phone}`} aria-label="Call agent">
                                    <Phone className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                        {sanitizedPhone && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80" asChild>
                                <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer" aria-label="Message agent on WhatsApp">
                                    <WhatsappIcon className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                        {agent.email && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80" asChild>
                                <a href={`mailto:${agent.email}`} aria-label="Email agent">
                                    <Mail className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={`${ACTION_CARD_CLASSNAME} p-0`}>
            <CardContent className="w-full p-4">
                 <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 ring-1 ring-emerald-300/18">
                            <AvatarImage src={agent.avatarUrl || undefined} alt={agent.name || 'Agent'}/>
                            <AvatarFallback className="bg-white/10 text-emerald-100">{getInitials(agent.name)}</AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                             <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/70">Agent dedicat</p>
                             <p className="text-base font-semibold leading-tight text-white">{agent.name || 'Agent nealocat'}</p>
                             {agent.phone && <p className="text-sm text-white/65">{agent.phone}</p>}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {agent.phone && (
                            <Button variant="ghost" size="icon" className={`h-10 w-10 rounded-full ${ACTION_PILL_CLASSNAME}`} asChild>
                                <a href={`tel:${agent.phone}`} aria-label="Call agent">
                                    <Phone className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                         {sanitizedPhone && (
                            <Button variant="ghost" size="icon" className={`h-10 w-10 rounded-full ${ACTION_PILL_CLASSNAME}`} asChild>
                                <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer" aria-label="Message agent on WhatsApp">
                                    <WhatsappIcon className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                        {agent.email && (
                            <Button variant="ghost" size="icon" className={`h-10 w-10 rounded-full ${ACTION_PILL_CLASSNAME}`} asChild>
                                <a href={`mailto:${agent.email}`} aria-label="Email agent">
                                    <Mail className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
