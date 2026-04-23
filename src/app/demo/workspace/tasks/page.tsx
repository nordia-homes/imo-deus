'use client';

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Task } from "@/lib/types";
import { useDemoSession } from "@/components/demo/DemoSessionProvider";
import { createDemoEntityId } from "@/components/demo/demo-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type TaskFormState = {
  id: string;
  description: string;
  dueDate: string;
  status: Task["status"];
  contactName: string;
  propertyTitle: string;
};

const DEFAULT_TASK_FORM: TaskFormState = {
  id: "",
  description: "",
  dueDate: "",
  status: "open",
  contactName: "",
  propertyTitle: "",
};

export default function DemoTasksPage() {
  const { state, saveTask, deleteTask } = useDemoSession();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<TaskFormState>(DEFAULT_TASK_FORM);

  const tasks = useMemo(() => [...(state?.tasks || [])], [state?.tasks]);

  const openCreate = () => {
    setForm(DEFAULT_TASK_FORM);
    setIsOpen(true);
  };

  const openEdit = (task: Task) => {
    setForm({
      id: task.id,
      description: task.description,
      dueDate: task.dueDate,
      status: task.status,
      contactName: task.contactName || "",
      propertyTitle: task.propertyTitle || "",
    });
    setIsOpen(true);
  };

  const handleSave = () => {
    const selectedContact = state?.contacts.find((item) => item.name === form.contactName);
    const selectedProperty = state?.properties.find((item) => item.title === form.propertyTitle);
    const selectedAgent = state?.agents[0];

    const nextTask: Task = {
      id: form.id || createDemoEntityId("demo-task"),
      description: form.description.trim() || "Task demo",
      dueDate: form.dueDate || new Date().toISOString().slice(0, 10),
      status: form.status,
      contactId: selectedContact?.id || null,
      contactName: form.contactName.trim() || selectedContact?.name || null,
      propertyId: selectedProperty?.id || null,
      propertyTitle: form.propertyTitle.trim() || selectedProperty?.title || null,
      agentId: selectedAgent?.id || null,
      agentName: selectedAgent?.name || null,
    };

    saveTask(nextTask);
    setIsOpen(false);
  };

  if (!state) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="rounded-[24px] border border-[var(--app-surface-border)] bg-white/72 px-5 py-4 shadow-[var(--agentfinder-soft-shadow)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Task management demo</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Task-urile din demo te ajuta sa arati operational cum se coordoneaza echipa in aplicatie.
          </p>
        </div>
        <Button type="button" className="rounded-full border-0 bg-[var(--agentfinder-primary-button)] text-white shadow-[var(--agentfinder-primary-button-shadow)] hover:bg-[var(--agentfinder-primary-button-hover)]" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Task nou
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {tasks.map((task) => (
          <Card key={task.id} className="rounded-[28px] border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg)] shadow-[var(--agentfinder-card-shadow)]">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-xl text-slate-950">{task.description}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button type="button" size="icon" variant="outline" className="rounded-full bg-white/80" onClick={() => openEdit(task)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="outline" className="rounded-full bg-white/80" onClick={() => deleteTask(task.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={task.status === "completed" ? "success" : "outline"} className={task.status === "completed" ? "" : "border-[var(--app-surface-border)] bg-white/82 text-slate-700"}>
                  {task.status}
                </Badge>
              </div>
              <div className="rounded-[18px] bg-white/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Scadenta</p>
                <p className="mt-1 text-base font-semibold text-slate-950">{task.dueDate}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] bg-white/80 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Lead</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{task.contactName || "-"}</p>
                </div>
                <div className="rounded-[18px] bg-white/80 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Proprietate</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{task.propertyTitle || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="rounded-[28px] border border-[var(--app-surface-border)] bg-white">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editeaza task demo" : "Task nou in demo"}</DialogTitle>
            <DialogDescription>Orice schimbare ramane doar in workspace-ul local de demo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input placeholder="Descriere task" value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
            <Input type="date" value={form.dueDate} onChange={(e) => setForm((current) => ({ ...current, dueDate: e.target.value }))} />
            <Input placeholder="Status" value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as Task["status"] }))} />
            <Input placeholder="Lead" value={form.contactName} onChange={(e) => setForm((current) => ({ ...current, contactName: e.target.value }))} />
          </div>
          <Textarea placeholder="Titlu proprietate asociata" value={form.propertyTitle} onChange={(e) => setForm((current) => ({ ...current, propertyTitle: e.target.value }))} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Anuleaza</Button>
            <Button type="button" onClick={handleSave}>Salveaza local</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
