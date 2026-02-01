'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import type { Property, Viewing, Contact, Task, UserProfile } from '@/lib/types';
import { User, MapPin, Calendar, UserCheck, MoreHorizontal, TrendingUp } from 'lucide-react';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';

type PropertyActionPanelProps = {
  property: Property;
  viewings: Viewing[];
  matchedLeads: Contact[];
  tasks: Task[];
  agents: UserProfile[];
  onUpdateProperty: (data: Partial<Omit<Property, 'id'>>) => void;
};

export function PropertyActionPanel({ property, viewings, matchedLeads, tasks, agents, onUpdateProperty }: PropertyActionPanelProps) {
  const [notes, setNotes] = useState(property.notes || '');

  const handleNotesBlur = () => {
      if (notes !== (property.notes || '')) {
          onUpdateProperty({ notes: notes });
      }
  };
  
  const handleAgentChange = (agentId: string) => {
    if (agentId === 'unassigned') {
        onUpdateProperty({ agentId: null, agentName: null });
    } else {
        const selectedAgent = agents.find(a => a.id === agentId);
        if (selectedAgent) {
            onUpdateProperty({ agentId: selectedAgent.id, agentName: selectedAgent.name });
        }
    }
  }

  const todayTasks = tasks.filter(t => new Date(t.dueDate).toDateString() === new Date().toDateString() && t.status === 'open');

  return (
    <div className="space-y-4 sticky top-28">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
            <CardTitle className="text-base">Setări Proprietate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
             <div>
                <Label className="text-xs text-muted-foreground">Status Proprietate</Label>
                <Select defaultValue={property.status} onValueChange={(value: Property['status']) => onUpdateProperty({ status: value })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Activ">Activ</SelectItem>
                        <SelectItem value="Inactiv">Inactiv</SelectItem>
                        <SelectItem value="Rezervat">Rezervat</SelectItem>
                        <SelectItem value="Vândut">Vândut</SelectItem>
                        <SelectItem value="Închiriat">Închiriat</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             <div>
                <Label className="text-xs text-muted-foreground">Agent Responsabil</Label>
                 <Select defaultValue={property.agentId || 'unassigned'} onValueChange={handleAgentChange}>
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
            <div>
                <Label className="text-xs text-muted-foreground">Potențial Vânzare</Label>
                <Select defaultValue={property.salesScore} onValueChange={(value: Property['salesScore']) => onUpdateProperty({ salesScore: value })}>
                    <SelectTrigger className="h-9">
                        <div className="flex items-center gap-2">
                             <TrendingUp className="h-4 w-4" />
                            <SelectValue placeholder="Selectează..." />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Scăzut">Scăzut</SelectItem>
                        <SelectItem value="Mediu">Mediu</SelectItem>
                        <SelectItem value="Ridicată">Ridicată</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>
      
      <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
              <CardTitle className="text-base">Vizionări Programate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
              {viewings.length > 0 ? viewings.map(v => (
                  <div key={v.id} className="text-sm p-2 rounded-md border">
                      <p className="font-semibold">{v.contactName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{format(parseISO(v.viewingDate), "d MMM yyyy, HH:mm", { locale: ro })}</p>
                  </div>
              )) : (
                <p className="text-sm text-muted-foreground text-center py-2">Nicio vizionare programată.</p>
              )}
          </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
         <CardHeader className="pb-2">
             <CardTitle className="text-base">Lead-uri Potrivite</CardTitle>
         </CardHeader>
         <CardContent className="space-y-3">
             {matchedLeads.length > 0 ? matchedLeads.map(lead => (
                 <Link key={lead.id} href={`/leads/${lead.id}`} className="block p-2 rounded-md border hover:bg-accent">
                   <div className="flex items-center justify-between">
                       <p className="font-semibold text-sm">{lead.name}</p>
                       <UserCheck className="h-4 w-4 text-primary" />
                   </div>
                   <p className="text-xs text-muted-foreground">Buget: €{lead.budget?.toLocaleString()}</p>
                 </Link>
             )) : (
               <p className="text-sm text-muted-foreground text-center py-2">Niciun lead potrivit găsit.</p>
             )}
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
                        <Checkbox id={`task-${task.id}`}/>
                        <label htmlFor={`task-${task.id}`} className="text-sm">{task.description}</label>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></Button>
                </div>
            )) : <p className="text-sm text-muted-foreground text-center py-2">Niciun task pentru azi.</p>}
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Notițe Interne</CardTitle>
        </CardHeader>
        <CardContent>
            <Textarea 
                placeholder="Adaugă o notiță rapidă despre proprietate..." 
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
