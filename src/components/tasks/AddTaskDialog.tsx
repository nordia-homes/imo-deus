"use client";

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from "date-fns";
import { ro } from "date-fns/locale";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, PlusCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { Task, Property } from '@/lib/types';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '../ui/card';
import { PropertyPicker, type PropertyPickerOption } from '@/components/viewings/PropertyPicker';

const taskSchema = z.object({
  description: z.string().min(1, { message: "Descrierea este obligatorie." }),
  dueDate: z.date({ required_error: "Data scadentă este obligatorie." }),
  startTime: z.string().optional(),
  duration: z.coerce.number().optional(),
  contactId: z.string().optional(),
  propertyId: z.string().optional(),
  participantName: z.string().trim().max(120, { message: "Numele este prea lung." }).optional(),
  participantPhone: z.string().trim().max(40, { message: "Numărul de telefon este prea lung." }).optional(),
});

const scheduledTaskSchema = taskSchema.extend({
  startTime: z.string().min(1, { message: "Ora de început este obligatorie." }),
  duration: z.coerce.number().min(1, { message: "Durata este obligatorie." }),
});

type ContactStub = { id: string; name: string; };
const PREDEFINED_TASKS = [
  'Notariat',
  'Prospectare pe teren',
  'Activități administrative',
] as const;

type TaskFormProps = {
    onClose: () => void;
    onAddTask: (task: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName'>) => void;
    contacts: ContactStub[];
    property?: Property | null;
    properties: Property[];
    isMobile: boolean;
    requireSchedule: boolean;
};

function TaskForm({ onClose, onAddTask, contacts, properties, property = null, isMobile, requireSchedule }: TaskFormProps) {
  const defaultContactId = useMemo(() => {
    if (contacts.length === 1) return contacts[0].id;
    return undefined;
  }, [contacts]);

  const availableProperties = useMemo(() => {
    if (!property || properties.some((item) => item.id === property.id)) return properties;
    return [property, ...properties];
  }, [properties, property]);

  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(requireSchedule ? scheduledTaskSchema : taskSchema),
    defaultValues: {
      description: '',
      duration: 30,
      contactId: defaultContactId,
      propertyId: property?.id,
      participantName: '',
      participantPhone: '',
    },
  });

  const selectedPreset = form.watch('description');

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
    const selectedProperty = availableProperties.find(item => item.id === values.propertyId);
    const participantName = values.participantName?.trim();
    const participantPhone = values.participantPhone?.trim();

    const taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName'> = {
        description: values.description,
        dueDate: format(values.dueDate, 'yyyy-MM-dd'),
        ...(values.startTime ? { startTime: values.startTime } : {}),
        ...(typeof values.duration === 'number' && Number.isFinite(values.duration) ? { duration: values.duration } : {}),
        ...(selectedContact ? {
          contactId: selectedContact.id,
          contactName: selectedContact.name,
        } : {}),
        ...(selectedProperty ? {
          propertyId: selectedProperty.id,
          propertyTitle: selectedProperty.title,
        } : {}),
        ...(participantName ? { participantName } : {}),
        ...(participantPhone ? { participantPhone } : {}),
    };

    onAddTask(taskData);

    onClose();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="agentfinder-add-task-dialog__form grid grid-rows-[1fr_auto] h-full">
        <div className={cn("agentfinder-add-task-dialog__body overflow-y-auto md:px-3 md:py-4 space-y-6 px-2 py-4", isMobile && "bg-[#0F1E33]")}>
            <Card className={cn("agentfinder-add-task-dialog__panel shadow-xl rounded-2xl", isMobile && "bg-[#152A47] border-none text-white")}>
                <CardContent className="pt-6 space-y-4">
                    <h3 className="text-lg font-semibold text-primary">Detalii Task</h3>
                    <div className="space-y-2">
                      <FormLabel className={cn(isMobile && "text-white/80")}>Task-uri predefinite</FormLabel>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {PREDEFINED_TASKS.map((preset) => (
                          <Button
                            key={preset}
                            type="button"
                            variant="outline"
                            onClick={() => form.setValue('description', preset, { shouldDirty: true, shouldValidate: true })}
                            className={cn(
                              "h-auto min-h-10 whitespace-normal px-3 py-2 text-sm",
                              selectedPreset === preset && "border-primary bg-primary/10 text-primary"
                            )}
                          >
                            {preset}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel className={cn(isMobile && "text-white/80")}>Descriere Task</FormLabel><FormControl><Textarea {...field} placeholder="ex: Sună clientul X pentru follow-up" className={cn(isMobile && "bg-white/10 border-white/20 text-white placeholder:text-white/50")} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField
                      control={form.control}
                      name="contactId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={cn(isMobile && "text-white/80")}>Asociază cu un Cumpărător (Opțional)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className={cn(isMobile && "bg-white/10 border-white/20 text-white")}><SelectValue placeholder="Selectează un cumpărător" /></SelectTrigger>
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
                    <FormField
                      control={form.control}
                      name="propertyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={cn(isMobile && "text-white/80")}>Asociază cu o Proprietate (Opțional)</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <PropertyPicker
                                value={field.value}
                                onValueChange={field.onChange}
                                properties={availableProperties as PropertyPickerOption[]}
                                placeholder="Selectează proprietatea"
                                tone={isMobile ? 'dark' : 'light'}
                              />
                              {field.value && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => field.onChange(undefined)}
                                  className={cn("h-8 px-2 text-xs", isMobile && "text-white/65 hover:bg-white/10 hover:text-white")}
                                >
                                  Elimină asocierea cu proprietatea
                                </Button>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="participantName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={cn(isMobile && "text-white/80")}>Participant (Opțional)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value ?? ''}
                                placeholder="Numele participantului"
                                className={cn(isMobile && "bg-white/10 border-white/20 text-white placeholder:text-white/50")}
                              />
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
                            <FormLabel className={cn(isMobile && "text-white/80")}>Telefon participant (Opțional)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value ?? ''}
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                placeholder="ex: 07xx xxx xxx"
                                className={cn(isMobile && "bg-white/10 border-white/20 text-white placeholder:text-white/50")}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                </CardContent>
            </Card>

            <Card className={cn("agentfinder-add-task-dialog__panel shadow-xl rounded-2xl", isMobile && "bg-[#152A47] border-none text-white")}>
                <CardContent className="pt-6 space-y-4">
                     <h3 className="text-lg font-semibold text-primary">Programare</h3>
                      <FormField
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={cn(isMobile && "text-white/80")}>Data Scadentă</FormLabel>
                            <Popover modal={true}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" className={cn("w-full pl-3 text-left font-normal",!field.value && "text-muted-foreground", isMobile && "bg-white/10 border-white/20 text-white")}>
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
                         <FormField control={form.control} name="startTime" render={({ field }) => (<FormItem><FormLabel className={cn(isMobile && "text-white/80")}>Ora de început</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className={cn(isMobile && "bg-white/10 border-white/20 text-white")}><SelectValue placeholder="Alege ora" /></SelectTrigger></FormControl><SelectContent>{timeSlots.map(time => (<SelectItem key={time} value={time}>{time}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                         <FormField control={form.control} name="duration" render={({ field }) => (<FormItem><FormLabel className={cn(isMobile && "text-white/80")}>Durată</FormLabel><Select onValueChange={(val) => field.onChange(Number(val))} defaultValue={String(field.value)}><FormControl><SelectTrigger className={cn(isMobile && "bg-white/10 border-white/20 text-white")}><SelectValue placeholder="Alege durata" /></SelectTrigger></FormControl><SelectContent>{durationOptions.map(option => (<SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                      </div>
                </CardContent>
            </Card>
        </div>

        <DialogFooter className={cn("agentfinder-add-task-dialog__footer shrink-0 border-t p-3 md:py-3 md:px-6 shadow-md", isMobile ? "bg-[#0F1E33] border-white/10" : "bg-background")}>
            <div className="flex justify-end gap-2 w-full">
              <Button type="button" variant="ghost" onClick={onClose} className={cn(isMobile && "text-white/80 hover:bg-white/10 hover:text-white/90")}>Anulează</Button>
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
    properties?: Property[];
    property?: Property | null;
    children?: React.ReactNode;
    requireSchedule?: boolean;
}

export function AddTaskDialog({ onAddTask, contacts, properties = [], property = null, children, requireSchedule = false }: AddTaskDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const formKey = useMemo(() => `add-task-${isOpen}`, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || <Button><PlusCircle className="mr-2 h-4 w-4" />Adaugă Task</Button>}
      </DialogTrigger>
      <DialogContent className={cn("agentfinder-add-task-dialog p-0 flex flex-col", isMobile ? "inset-0 left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-none" : "sm:max-w-2xl h-[90vh]")}>
        <DialogHeader className={cn("agentfinder-add-task-dialog__header shrink-0 border-b p-2 h-14 flex items-center justify-center shadow-md z-10 relative", isMobile ? "bg-[#0F1E33] border-white/10" : "bg-background")}>
          <DialogTitle className={cn("text-xl text-foreground/90", isMobile && "text-white/90")}>{property ? 'Adaugă Task' : 'Adaugă Task Nou'}</DialogTitle>
          {property && <DialogDescription className={cn("text-center -mt-1", isMobile && "text-white/70")}>{property.title}</DialogDescription>}
        </DialogHeader>
        <div className="flex-1 min-h-0">
            {isOpen && <TaskForm key={formKey} onClose={() => setIsOpen(false)} onAddTask={onAddTask} contacts={contacts} properties={properties} property={property} isMobile={isMobile} requireSchedule={requireSchedule} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
