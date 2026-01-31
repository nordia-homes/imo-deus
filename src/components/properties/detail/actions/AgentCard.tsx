'use client';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone } from "lucide-react";

type AgentInfo = {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
}

export function AgentCard({ agent }: { agent: AgentInfo }) {
    return (
        <Card className="rounded-2xl">
             <CardHeader>
                <CardTitle className="text-base font-semibold">Agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                 <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                        <AvatarImage src={agent.avatarUrl || undefined} />
                        <AvatarFallback>{agent.name?.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{agent.name}</p>
                        <p className="text-sm text-muted-foreground">Agent Responsabil</p>
                    </div>
                </div>
                <div className="space-y-2">
                    {agent.phone && (
                        <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                           <a href={`tel:${agent.phone}`}><Phone />{agent.phone}</a>
                        </Button>
                    )}
                     {agent.email && (
                        <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                           <a href={`mailto:${agent.email}`}><Mail />{agent.email}</a>
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
