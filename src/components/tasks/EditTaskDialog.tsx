
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from "date-fns";
import { ro } from "date-fns/locale";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { Task } from '@/lib/types';
import { Textarea } from '../ui/textarea';

const taskSchema = z.object({
  description: z.string().min(1, { message: "Descrierea este obligatorie." }),
  dueDate: z.date({ required_error: "Data scadentă este obligatorie." }),
  startTime: z.string().optional(),
  duration: z.coerce.number().optional(),
  contactId: z.string().optional(),
});

type ContactStub = { id: string; name: string; };

type EditTaskDialogProps = {
    task: Task | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdateTask: (task: Omit<Task, 'status'>) => void;
    contacts: ContactStub[];
}

export function EditTaskDialog({ task, isOpen, onOpenChange, onUpdateTask, contacts }: EditTaskDialogProps) {
  
  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
  });

  useEffect(() => {
    if (task) {
        form.reset({
            description: task.description,
            dueDate: new Date(task.dueDate),
            startTime: task.startTime,
            duration: task.duration,
            contactId: task.contactId || 'unassigned',
        });
    }
  }, [task, form]);

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
    if (!task) return;
    
    const isUnassigned = !values.contactId || values.contactId === 'unassigned';
    const finalContactId = isUnassigned ? null : values.contactId;
    const selectedContact = contacts.find(c => c.id === finalContactId);
    
    onUpdateTask({
        id: task.id,
        description: values.description,
        dueDate: format(values.dueDate, 'yyyy-MM-dd'),
        startTime: values.startTime,
        duration: values.duration,
        contactId: finalContactId,
        contactName: selectedContact?.name || null,
    });

    onOpenChange(false);
  }

  if (!isOpen || !task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editează Task</DialogTitle>
          <DialogDescription>
            Modifică detaliile sarcinii.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Descriere Task</FormLabel><FormControl><Textarea {...field} placeholder="ex: Sună clientul X pentru follow-up" /></FormControl><FormMessage /></FormItem> )} />
              
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data Scadentă</FormLabel>
                    <Popover modal={true}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: ro })
                            ) : (
                              <span>Alege o dată</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setDate(new Date().getDate() - 1))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Ora de început</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Alege ora" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {timeSlots.map(time => (
                                        <SelectItem key={time} value={time}>{time}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Durată</FormLabel>
                            <Select onValueChange={(val) => field.onChange(Number(val))} defaultValue={String(field.value)}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Alege durata" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {durationOptions.map(option => (
                                        <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
              </div>

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
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Anulează</Button>
              <Button type="submit">Salvează Modificări</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
