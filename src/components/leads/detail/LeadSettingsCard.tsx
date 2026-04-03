
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
        <Card className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#142c4a_0%,#0f2036_62%,#0c1828_100%)] text-white shadow-[0_30px_80px_-38px_rgba(0,0,0,0.9)]">
            <CardHeader className="p-5 pb-3">
                <CardTitle className="text-base text-white">Setări Cumpărător</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
                 <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Status</Label>
                    <Select defaultValue={contact.status} onValueChange={(value: Contact['status']) => onUpdateContact({ status: value })}>
                        <SelectTrigger className="mt-2 h-11 rounded-2xl border-white/10 bg-white/6"><SelectValue /></SelectTrigger>
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
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Probabilitate</Label>
                    <Select defaultValue={contact.priority} onValueChange={(value: Contact['priority']) => onUpdateContact({ priority: value })}>
                        <SelectTrigger className="mt-2 h-11 rounded-2xl border-white/10 bg-white/6"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Scăzută">Scăzută</SelectItem>
                            <SelectItem value="Medie">Medie</SelectItem>
                            <SelectItem value="Ridicată">Ridicată</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
                 <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Agent</Label>
                     <Select defaultValue={contact.agentId || 'unassigned'} onValueChange={handleAgentChange}>
                        <SelectTrigger className="mt-2 h-11 rounded-2xl border-white/10 bg-white/6">
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
