'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import type { Contact, Task, UserProfile } from '@/lib/types';
import { Mail, MoreHorizontal, Phone, Plus, CheckCircle, ChevronDown, User } from 'lucide-react';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';
import { Label } from '@/components/ui/label';

type LeadActionPanelProps = {
  contact: Contact;
  tasks: Task[];
  agents: UserProfile[];
};

export function LeadActionPanel({ contact, tasks, agents }: LeadActionPanelProps) {
    const todayTasks = tasks.filter(t => new Date(t.dueDate).toDateString() === new Date().toDateString() && t.status === 'open');

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Contact</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6"><ChevronDown className="h-4 w-4" /></Button>
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
            <a href={`https://wa.me/${contact.phone}`} target="_blank" className="flex items-center gap-3 group">
                <WhatsappIcon className="h-4 w-4 text-muted-foreground"/>
                <span className="group-hover:underline">Trimite mesaj WhatsApp</span>
            </a>
        </CardContent>
      </Card>
      
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
            <CardTitle className="text-base">Setări Lead</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
             <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select defaultValue={contact.status}>
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
                <Select defaultValue={contact.priority}>
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
                 <Select defaultValue={contact.agentId || 'unassigned'}>
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

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
            <CardTitle className="text-base">Task-uri Azi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
            {todayTasks.length > 0 ? todayTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                        <Checkbox id={`task-${task.id}`} />
                        <label htmlFor={`task-${task.id}`} className="text-sm">{task.description}</label>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"><ChevronDown className="h-4 w-4" /></Button>
                </div>
            )) : <p className="text-sm text-muted-foreground text-center py-2">Niciun task pentru azi.</p>}
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-primary">
                <Plus className="h-4 w-4 mr-1" /> Adaugă notiță
            </Button>
        </CardContent>
      </Card>
      
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Notițe</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
            <Textarea placeholder="Adaugă o notiță rapidă..." className="bg-background" defaultValue={contact.notes} />
        </CardContent>
      </Card>

    </div>
  );
}
