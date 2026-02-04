'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Contact, UserProfile } from '@/lib/types';
import { User } from 'lucide-react';
import { Label } from '@/components/ui/label';

type LeadSettingsCardProps = {
  contact: Contact;
  agents: UserProfile[];
  onUpdateContact: (data: Partial<Omit<Contact, 'id'>>) => void;
};

export function LeadSettingsCard({ contact, agents, onUpdateContact }: LeadSettingsCardProps) {
    const handleAgentChange = (agentId: string) => {
        if (agentId === 'unassigned') {
            onUpdateContact({ agentId: null, agentName: null });
        } else {
            const selectedAgent = agents.find(a => a.id === agentId);
            if (selectedAgent) {
                onUpdateContact({ agentId: selectedAgent.id, agentName: selectedAgent.name });
            }
        }
    }

    return (
        <Card className="rounded-2xl shadow-2xl">
            <CardHeader className="pb-4">
                <CardTitle className="text-base">Setări Lead</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select defaultValue={contact.status} onValueChange={(value: Contact['status']) => onUpdateContact({ status: value })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Nou">Nou</SelectItem>
                            <SelectItem value="Contactat">Contactat</SelectItem>
                            <SelectItem value="Vizionare">Vizionare</SelectItem>
                            <SelectItem value="În negociere">În negociere</SelectItem>
                            <SelectItem value="Câștigat">Câștigat</SelectItem>
                            <SelectItem value="Pierdut">Pierdut</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div>
                    <Label className="text-xs text-muted-foreground">Probabilitate</Label>
                    <Select defaultValue={contact.priority} onValueChange={(value: Contact['priority']) => onUpdateContact({ priority: value })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Scăzută">Scăzută</SelectItem>
                            <SelectItem value="Medie">Medie</SelectItem>
                            <SelectItem value="Ridicată">Ridicată</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div>
                    <Label className="text-xs text-muted-foreground">Agent</Label>
                     <Select defaultValue={contact.agentId || 'unassigned'} onValueChange={handleAgentChange}>
                        <SelectTrigger className="h-9">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <SelectValue />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                             <SelectItem value="unassigned">Nealocat</SelectItem>
                             {agents.map(agent => (
                                <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                             ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>
    );
}
