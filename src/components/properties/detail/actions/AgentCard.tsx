'use client';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone } from "lucide-react";
import { WhatsappIcon } from "@/components/icons/WhatsappIcon";

type AgentInfo = {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
}

export function AgentCard({ agent }: { agent: AgentInfo }) {
    const getInitials = (name?: string | null) => {
        if (!name) return 'A';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    
    const sanitizedPhone = agent.phone?.replace(/\D/g, '') || '';

    return (
        <Card className="rounded-2xl shadow-2xl">
            <CardContent className="p-3">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={agent.avatarUrl || undefined} alt={agent.name || 'Agent'}/>
                            <AvatarFallback>{getInitials(agent.name)}</AvatarFallback>
                        </Avatar>
                        <p className="font-semibold">{agent.name}</p>
                    </div>

                    <div className="flex items-center">
                        {agent.phone && (
                            <Button variant="ghost" size="icon" asChild>
                                <a href={`tel:${agent.phone}`} aria-label="Call agent">
                                    <Phone />
                                </a>
                            </Button>
                        )}
                         {sanitizedPhone && (
                            <Button variant="ghost" size="icon" asChild>
                                <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer" aria-label="Message agent on WhatsApp">
                                    <WhatsappIcon />
                                </a>
                            </Button>
                        )}
                        {agent.email && (
                            <Button variant="ghost" size="icon" asChild>
                                <a href={`mailto:${agent.email}`} aria-label="Email agent">
                                    <Mail />
                                </a>
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
