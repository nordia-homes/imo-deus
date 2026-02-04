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
        <Card className="rounded-2xl shadow-2xl">
             <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Agent Responsabil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                 <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={agent.avatarUrl || undefined} />
                        <AvatarFallback>{agent.name?.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{agent.name}</p>
                    </div>
                </div>
                <div className="space-y-2">
                    <Button variant="outline" className="w-full">
                        Contactează Agentul
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
