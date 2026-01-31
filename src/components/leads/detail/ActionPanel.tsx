'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import type { Contact, Task, UserProfile, Agency } from '@/lib/types';
import { Mail, MoreHorizontal, Phone, Plus, CheckCircle, ChevronDown, User, MapPin } from 'lucide-react';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';
import { Label } from '@/components/ui/label';
import { ClientPortalManager } from '@/components/leads/ClientPortalManager';

type LeadActionPanelProps = {
  contact: Contact;
  tasks: Task[];
  agents: UserProfile[];
  agency: Agency;
  onUpdateContact: (data: Partial<Omit<Contact, 'id'>>) => void;
  onUpdateTask: (taskId: string, data: Partial<Task>) => void;
};

export function LeadActionPanel({ contact, tasks, agents, agency, onUpdateContact, onUpdateTask }: LeadActionPanelProps) {
    const todayTasks = tasks.filter(t => new Date(t.dueDate).toDateString() === new Date().toDateString() && t.status === 'open');
    const [notes, setNotes] = useState(contact.notes || '');

    const handleNotesBlur = () => {
        if (notes !== contact.notes) {
            onUpdateContact({ notes: notes });
        }
    };

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
    
    const handleTaskComplete = (task: Task) => {
        onUpdateTask(task.id, { status: 'completed' });
    }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
            <CardTitle className="text-base">Setări Lead</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
                <Label className="text-xs text-muted-foreground">Prioritate</Label>
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
      
      {contact.zones && contact.zones.length > 0 && (
          <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                  <CardTitle className="text-base">Zone de Interes</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                  {contact.zones.map(zone => (
                      <Button key={zone} variant="outline" size="sm" className="pointer-events-none cursor-default">
                          <MapPin className="mr-2 h-3.5 w-3.5" />
                          {zone}
                      </Button>
                  ))}
              </CardContent>
          </Card>
      )}

       <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
            <a href={`tel:${contact.phone}`} className="flex items-center gap-3 group">
                <Phone className="h-4 w-4 text-muted-foreground"/>
                <span className="group-hover:underline">{contact.phone}</span>
            </a>
             <a href={`mailto:${contact.email}`} className="flex items-center gap-3 group">
                <Mail className="h-4 w-4 text-muted-foreground"/>
                <span className="group-hover:underline">{contact.email}</span>
            </a>
            <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`} target="_blank" className="flex items-center gap-3 group">
                <WhatsappIcon className="h-4 w-4 text-muted-foreground"/>
                <span className="group-hover:underline">Trimite mesaj WhatsApp</span>
            </a>
        </CardContent>
      </Card>
      
      <ClientPortalManager contact={contact} agency={agency} />

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
            <CardTitle className="text-base">Task-uri Azi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
            {todayTasks.length > 0 ? todayTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                        <Checkbox id={`task-${task.id}`} onCheckedChange={() => handleTaskComplete(task)}/>
                        <label htmlFor={`task-${task.id}`} className="text-sm">{task.description}</label>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></Button>
                </div>
            )) : <p className="text-sm text-muted-foreground text-center py-2">Niciun task pentru azi.</p>}
        </CardContent>
      </Card>
      
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Notițe</CardTitle>
        </CardHeader>
        <CardContent>
            <Textarea 
                placeholder="Adaugă o notiță rapidă..." 
                className="bg-background" 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
            />
        </CardContent>
      </Card>

    </div>
  );
}
