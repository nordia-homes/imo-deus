"use client";

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from "date-fns";
import { ro } from "date-fns/locale";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, PlusCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { Task, Property } from '@/lib/types';
import { Textarea } from '../ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '../ui/card';

const taskSchema = z.object({
  description: z.string().min(1, { message: "Descrierea este obligatorie." }),
  dueDate: z.date({ required_error: "Data scadentă este obligatorie." }),
  startTime: z.string().optional(),
  duration: z.coerce.number().optional(),
  contactId: z.string().optional(),
});

type ContactStub = { id: string; name: string; };

type TaskFormProps = {
    onClose: () => void;
    onAddTask: (task: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName'>) => void;
    contacts: ContactStub[];
    property?: Property | null;
};

function TaskForm({ onClose, onAddTask, contacts, property = null }: TaskFormProps) {
  const defaultContactId = useMemo(() => {
    if (contacts.length === 1) return contacts[0].id;
    return undefined;
  }, [contacts]);

  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      description: '',
      duration: 30,
      contactId: defaultContactId,
    },
  });

  const timeSlots = useMemo(() => {
      const slots = [];
      for (let h = 8; h < 22; h++) {
          for (let m = 0; m < 60; m += 30) {
              const hour = h.toString().padStart(2, '0');
              const minute = m.toString().padStart(2, '0');
              slots.push(`${hour}:${minute}`);
          }
      }
      return slots;
  }, []);

  const durationOptions = [
    { value: 15, label: '15 minute' },
    { value: 30, label: '30 minute' },
    { value: 45, label: '45 minute' },
    { value: 60, label: '1 oră' },
    { value: 90, label: '1.5 ore' },
  ];

  function onSubmit(values: z.infer<typeof taskSchema>) {
    const selectedContact = contacts.find(c => c.id === values.contactId);
    
    onAddTask({
        description: values.description,
        dueDate: format(values.dueDate, 'yyyy-MM-dd'),
        startTime: values.startTime,
        duration: values.duration,
        contactId: values.contactId === 'unassigned' ? undefined : values.contactId,
        contactName: selectedContact?.name,
        propertyId: property?.id,
        propertyTitle: property?.title,
    });

    onClose();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-rows-[1fr_auto] h-full">
        <div className="overflow-y-auto md:px-3 md:py-4 space-y-6 px-2 py-4">
            <Card className="shadow-xl rounded-2xl">
                <CardContent className="pt-6 space-y-4">
                    <h3 className="text-lg font-semibold text-primary">Detalii Task</h3>
                    <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Descriere Task</FormLabel><FormControl><Textarea {...field} placeholder="ex: Sună clientul X pentru follow-up" /></FormControl><FormMessage /></FormItem> )} />
                    <FormField
                      control={form.control}
                      name="contactId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asociază cu un Cumpărător (Opțional)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Selectează un cumpărător" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="unassigned">Niciunul</SelectItem>
                              {contacts.map(contact => (
                                <SelectItem key={contact.id} value={contact.id}>{contact.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </CardContent>
            </Card>

            <Card className="shadow-xl rounded-2xl">
                <CardContent className="pt-6 space-y-4">
                     <h3 className="text-lg font-semibold text-primary">Programare</h3>
                      <FormField
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data Scadentă</FormLabel>
                            <Popover modal={true}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" className={cn("w-full pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>
                                    {field.value ? (format(field.value, "PPP", { locale: ro })) : (<span>Alege o dată</span>)}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={ro} disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1))} initialFocus/>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                         <FormField control={form.control} name="startTime" render={({ field }) => (<FormItem><FormLabel>Ora de început</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Alege ora" /></SelectTrigger></FormControl><SelectContent>{timeSlots.map(time => (<SelectItem key={time} value={time}>{time}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                         <FormField control={form.control} name="duration" render={({ field }) => (<FormItem><FormLabel>Durată</FormLabel><Select onValueChange={(val) => field.onChange(Number(val))} defaultValue={String(field.value)}><FormControl><SelectTrigger><SelectValue placeholder="Alege durata" /></SelectTrigger></FormControl><SelectContent>{durationOptions.map(option => (<SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                      </div>
                </CardContent>
            </Card>
        </div>

        <DialogFooter className="shrink-0 border-t bg-background p-3 md:py-3 md:px-6 shadow-md">
            <div className="flex justify-end gap-2 w-full">
              <Button type="button" variant="ghost" onClick={onClose}>Anulează</Button>
              <Button type="submit">Salvează Task</Button>
            </div>
        </DialogFooter>
      </form>
    </Form>
  );
}

type AddTaskDialogProps = {
    onAddTask: (task: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName'>) => void;
    contacts: ContactStub[];
    property?: Property | null;
    children?: React.ReactNode;
}

export function AddTaskDialog({ onAddTask, contacts, property = null, children }: AddTaskDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const formKey = useMemo(() => `add-task-${isOpen}`, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || <Button><PlusCircle className="mr-2 h-4 w-4" />Adaugă Task</Button>}
      </DialogTrigger>
      <DialogContent className={cn("p-0 flex flex-col", isMobile ? "h-screen w-screen max-w-full rounded-none border-none" : "sm:max-w-2xl h-[90vh]")}>
        <DialogHeader className="shrink-0 border-b p-2 h-14 flex items-center justify-center shadow-md z-10 relative bg-background">
          <DialogTitle className="text-xl text-foreground/90">{property ? 'Adaugă Task' : 'Adaugă Task Nou'}</DialogTitle>
          {property && <DialogDescription className="text-center -mt-1">{property.title}</DialogDescription>}
        </DialogHeader>
        <div className="flex-1 min-h-0">
            {isOpen && <TaskForm key={formKey} onClose={() => setIsOpen(false)} onAddTask={onAddTask} contacts={contacts} property={property} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
