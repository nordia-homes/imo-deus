"use client";

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { Property, Task } from '@/lib/types';
import { Textarea } from '../ui/textarea';
import { PropertyPicker, type PropertyPickerOption } from '@/components/viewings/PropertyPicker';

const taskSchema = z.object({
  description: z.string().min(1, { message: 'Descrierea este obligatorie.' }),
  dueDate: z.date({ required_error: 'Data scadentă este obligatorie.' }),
  startTime: z.string().optional(),
  duration: z.coerce.number().optional(),
  contactId: z.string().optional(),
  propertyId: z.string().optional(),
  participantName: z.string().trim().max(120, { message: 'Numele este prea lung.' }).optional(),
  participantPhone: z.string().trim().max(40, { message: 'Numărul de telefon este prea lung.' }).optional(),
});

type ContactStub = { id: string; name: string };

type EditTaskDialogProps = {
  task: Task | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTask: (task: Omit<Task, 'status'>) => void;
  contacts: ContactStub[];
  properties?: Property[];
};

export function EditTaskDialog({
  task,
  isOpen,
  onOpenChange,
  onUpdateTask,
  contacts,
  properties = [],
}: EditTaskDialogProps) {
  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
  });

  useEffect(() => {
    if (!task) return;

    form.reset({
      description: task.description,
      dueDate: parseISO(task.dueDate),
      startTime: task.startTime,
      duration: task.duration ?? 30,
      contactId: task.contactId || 'unassigned',
      propertyId: task.propertyId || undefined,
      participantName: task.participantName || '',
      participantPhone: task.participantPhone || '',
    });
  }, [task, form]);

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 8; hour < 22; hour += 1) {
      for (let minute = 0; minute < 60; minute += 30) {
        slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
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

    const contactId = !values.contactId || values.contactId === 'unassigned' ? null : values.contactId;
    const selectedContact = contacts.find((contact) => contact.id === contactId);
    const selectedProperty = properties.find((property) => property.id === values.propertyId);
    const canEditProperty = properties.length > 0;
    const propertyId = canEditProperty ? selectedProperty?.id || null : task.propertyId || null;
    const propertyTitle = canEditProperty ? selectedProperty?.title || null : task.propertyTitle || null;
    const participantName = values.participantName?.trim() || null;
    const participantPhone = values.participantPhone?.trim() || null;

    onUpdateTask({
      id: task.id,
      description: values.description,
      dueDate: format(values.dueDate, 'yyyy-MM-dd'),
      contactId,
      contactName: selectedContact?.name || null,
      propertyId,
      propertyTitle,
      participantName,
      participantPhone,
      ...(values.startTime ? { startTime: values.startTime } : {}),
      ...(typeof values.duration === 'number' && Number.isFinite(values.duration)
        ? { duration: values.duration }
        : {}),
      ...(task.agentId ? { agentId: task.agentId } : {}),
      ...(task.agentName ? { agentName: task.agentName } : {}),
    });

    onOpenChange(false);
  }

  if (!isOpen || !task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editează Task</DialogTitle>
          <DialogDescription>Modifică detaliile sarcinii.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descriere Task</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="ex: Sună clientul pentru follow-up" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data Scadentă</FormLabel>
                  <Popover modal>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                        >
                          {field.value ? format(field.value, 'PPP', { locale: ro }) : <span>Alege o dată</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        locale={ro}
                        disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ora de început</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Alege ora" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeSlots.map((time) => <SelectItem key={time} value={time}>{time}</SelectItem>)}
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
                    <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value ? String(field.value) : undefined}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Alege durata" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {durationOptions.map((option) => (
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
                  <Select onValueChange={field.onChange} value={field.value || 'unassigned'}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selectează un cumpărător" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unassigned">Niciunul</SelectItem>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>{contact.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {properties.length > 0 ? (
              <FormField
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asociază cu o Proprietate (Opțional)</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <PropertyPicker
                          value={field.value}
                          onValueChange={field.onChange}
                          properties={properties as PropertyPickerOption[]}
                          placeholder="Selectează proprietatea"
                          tone="light"
                        />
                        {field.value ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange(undefined)}>
                            Elimină asocierea cu proprietatea
                          </Button>
                        ) : null}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="participantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Participant (Opțional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} placeholder="Numele participantului" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="participantPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefon participant (Opțional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="ex: 07xx xxx xxx"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
