"use client";

import type { LucideIcon } from 'lucide-react';
import {
  CalendarClock,
  CalendarSync,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Facebook,
  HousePlus,
  MessageCircleMore,
  MessageSquareHeart,
  Send,
  TriangleAlert,
  UserRoundCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppNotification, NotificationCategory } from '@/lib/notifications/types';

type CategoryVisual = {
  icon: LucideIcon;
  label: string;
  iconClassName: string;
  haloClassName: string;
};

const CATEGORY_VISUALS: Record<NotificationCategory, CategoryVisual> = {
  storiaMessages: {
    icon: MessageCircleMore,
    label: 'Storia',
    iconClassName: 'bg-emerald-500/[0.12] text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
    haloClassName: 'bg-emerald-400/20',
  },
  viewingAssignments: {
    icon: UserRoundCheck,
    label: 'Vizionare',
    iconClassName: 'bg-sky-500/[0.12] text-sky-700 ring-sky-500/20 dark:text-sky-300',
    haloClassName: 'bg-sky-400/20',
  },
  viewingRescheduled: {
    icon: CalendarSync,
    label: 'Reprogramare',
    iconClassName: 'bg-amber-500/[0.12] text-amber-700 ring-amber-500/20 dark:text-amber-300',
    haloClassName: 'bg-amber-400/20',
  },
  viewingReminders: {
    icon: CalendarClock,
    label: 'Reminder',
    iconClassName: 'bg-violet-500/[0.12] text-violet-700 ring-violet-500/20 dark:text-violet-300',
    haloClassName: 'bg-violet-400/20',
  },
  taskAssignments: {
    icon: ClipboardCheck,
    label: 'Task',
    iconClassName: 'bg-indigo-500/[0.12] text-indigo-700 ring-indigo-500/20 dark:text-indigo-300',
    haloClassName: 'bg-indigo-400/20',
  },
  taskUpdates: {
    icon: CheckCircle2,
    label: 'Task modificat',
    iconClassName: 'bg-blue-500/[0.12] text-blue-700 ring-blue-500/20 dark:text-blue-300',
    haloClassName: 'bg-blue-400/20',
  },
  facebookCompleted: {
    icon: Facebook,
    label: 'Facebook',
    iconClassName: 'bg-cyan-500/[0.12] text-cyan-700 ring-cyan-500/20 dark:text-cyan-300',
    haloClassName: 'bg-cyan-400/20',
  },
  facebookFailed: {
    icon: TriangleAlert,
    label: 'Eroare publicare',
    iconClassName: 'bg-rose-500/[0.12] text-rose-700 ring-rose-500/20 dark:text-rose-300',
    haloClassName: 'bg-rose-400/20',
  },
  propertyAssignments: {
    icon: HousePlus,
    label: 'Proprietate',
    iconClassName: 'bg-teal-500/[0.12] text-teal-700 ring-teal-500/20 dark:text-teal-300',
    haloClassName: 'bg-teal-400/20',
  },
  clientPortalFeedback: {
    icon: MessageSquareHeart,
    label: 'Feedback client',
    iconClassName: 'bg-fuchsia-500/[0.12] text-fuchsia-700 ring-fuchsia-500/20 dark:text-fuchsia-300',
    haloClassName: 'bg-fuchsia-400/20',
  },
};

function notificationDate(value: AppNotification['createdAt']) {
  const date = typeof value === 'string' ? new Date(value) : value?.toDate?.();
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function notificationDateLabel(value: AppNotification['createdAt']) {
  const date = notificationDate(value);
  return date
    ? new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '';
}

export function notificationRelativeLabel(value: AppNotification['createdAt']) {
  const date = notificationDate(value);
  if (!date) return '';
  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('ro-RO', { numeric: 'auto' });
  const absoluteSeconds = Math.abs(deltaSeconds);

  if (absoluteSeconds < 60) return 'acum';
  if (absoluteSeconds < 60 * 60) return formatter.format(Math.round(deltaSeconds / 60), 'minute');
  if (absoluteSeconds < 24 * 60 * 60) return formatter.format(Math.round(deltaSeconds / 3600), 'hour');
  if (absoluteSeconds < 7 * 24 * 60 * 60) return formatter.format(Math.round(deltaSeconds / 86400), 'day');
  return notificationDateLabel(value);
}

export function isNotificationToday(value: AppNotification['createdAt']) {
  const date = notificationDate(value);
  if (!date) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

export function NotificationItem({
  item,
  onOpen,
  compact = false,
}: {
  item: AppNotification;
  onOpen: (item: AppNotification) => void;
  compact?: boolean;
}) {
  const visual = CATEGORY_VISUALS[item.category] || CATEGORY_VISUALS.taskUpdates;
  const Icon = visual.icon;
  const timeLabel = compact ? notificationRelativeLabel(item.createdAt) : notificationDateLabel(item.createdAt);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        'group relative flex w-full items-start overflow-hidden border text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        compact ? 'gap-3 rounded-2xl px-3 py-3' : 'gap-4 rounded-[24px] px-4 py-4 sm:px-5',
        item.isRead
          ? 'border-border/60 bg-background/65 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-background hover:shadow-lg'
          : 'border-primary/15 bg-gradient-to-br from-background via-background to-emerald-50/70 shadow-[0_14px_40px_-28px_rgba(16,185,129,0.65)] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl dark:to-emerald-950/20',
      )}
    >
      <span className={cn('pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl', visual.haloClassName)} />
      {!item.isRead ? <span className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-gradient-to-b from-emerald-400 via-cyan-400 to-violet-400" /> : null}

      <span className={cn(
        'relative flex shrink-0 items-center justify-center rounded-2xl ring-1 transition-transform duration-300 group-hover:scale-105',
        compact ? 'h-11 w-11' : 'h-12 w-12 sm:h-14 sm:w-14',
        visual.iconClassName,
      )}>
        <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
        {!item.isRead ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.9)]" /> : null}
      </span>

      <span className="relative min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{visual.label}</span>
          {item.priority === 'reminder' ? (
            <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">Reminder</span>
          ) : null}
          {item.priority === 'action_required' && !item.isRead ? (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Nou</span>
          ) : null}
        </span>
        <span className={cn('mt-1 block font-semibold leading-snug text-foreground', compact ? 'text-sm' : 'text-base sm:text-[17px]')}>{item.title}</span>
        <span className={cn('mt-1 block text-muted-foreground', compact ? 'line-clamp-2 text-xs leading-relaxed' : 'text-sm leading-relaxed')}>{item.body}</span>
        <span className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/80">
          <Clock3 className="h-3.5 w-3.5" />
          {timeLabel}
        </span>
      </span>

      <span className="relative mt-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition-all duration-300 group-hover:translate-x-0.5 group-hover:bg-primary/10 group-hover:text-primary">
        {item.category === 'facebookCompleted' ? <Send className="h-3.5 w-3.5" /> : <ChevronRight className="h-4 w-4" />}
      </span>
    </button>
  );
}
