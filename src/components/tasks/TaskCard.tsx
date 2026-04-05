'use client';

import type { Task } from "@/lib/types";
import { CalendarDays, CheckCircle2, Clock3, Pencil, UserRound } from 'lucide-react';
import Link from 'next/link';
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { Button } from "../ui/button";

type TaskCardProps = {
    task: Task;
    onEdit?: (task: Task) => void;
    onToggleComplete?: (task: Task) => void;
    className?: string;
};

export function TaskCard({ task, onEdit, onToggleComplete, className }: TaskCardProps) {
    const formattedDueDate = !Number.isNaN(new Date(task.dueDate).getTime())
        ? format(new Date(task.dueDate), "d MMM", { locale: ro })
        : task.dueDate;

    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-[22px] border border-white/[0.12] bg-[#172742] text-white shadow-[0_16px_40px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_22px_52px_rgba(0,0,0,0.24)]",
                task.status === 'completed' && "bg-[#132238] opacity-60",
                className
            )}
        >
            <div className="pointer-events-none absolute inset-0 rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
            <div className="relative p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.08] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/[0.65]">
                                <CalendarDays className="h-3 w-3" />
                                {formattedDueDate}
                            </span>
                            {task.startTime && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/10 bg-sky-300/10 px-2.5 py-1 text-[11px] font-medium text-sky-100">
                                    <Clock3 className="h-3 w-3" />
                                    {task.startTime}
                                </span>
                            )}
                        </div>
                        <p className={cn("pr-2 text-sm font-medium leading-6 text-white/92", task.status === 'completed' && 'line-through text-white/45')}>
                            {task.description}
                        </p>
                    </div>
                </div>

                {(task.contactId && task.contactName) && (
                    <div className={cn("mt-3 flex items-center gap-2 text-xs", task.status === 'completed' ? "text-white/45" : "text-white/70")}>
                        <UserRound className="h-3.5 w-3.5" />
                        <span>
                            Pentru{" "}
                            <Link href={`/leads/${task.contactId}`} className="font-medium text-sky-200 hover:text-sky-100 hover:underline">
                                {task.contactName}
                            </Link>
                        </span>
                    </div>
                )}

                {(onEdit || onToggleComplete) && (
                    <div className="mt-4 flex items-center gap-2">
                        {onEdit && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.08] text-white hover:bg-white/[0.14] hover:text-white"
                                onClick={() => onEdit(task)}
                                aria-label="Editează task"
                                title="Editează task"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        {onToggleComplete && (
                            <Button
                                type="button"
                                size="sm"
                                className={cn(
                                    "h-8 rounded-xl px-3 text-xs font-medium",
                                    task.status === 'completed'
                                        ? "bg-white/[0.08] text-white hover:bg-white/[0.14]"
                                        : "bg-emerald-500/85 text-white hover:bg-emerald-500"
                                )}
                                onClick={() => onToggleComplete(task)}
                            >
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                {task.status === 'completed' ? 'Redeschide' : 'Finalizează'}
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
