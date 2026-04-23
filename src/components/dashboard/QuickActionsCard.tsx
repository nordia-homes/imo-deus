'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Task, Contact, Viewing, Property, ActiveBuyersEvolutionData } from '@/lib/types';
import { AddTaskDialog } from '../tasks/AddTaskDialog';
import { Clock, Plus, Calendar } from 'lucide-react';
import { parseISO, format, isToday } from 'date-fns';
import { ro } from 'date-fns/locale';
import Link from 'next/link';
import { ActiveBuyersChart } from './ActiveBuyersChart';
import { Separator } from '../ui/separator';

type ConfettiParticle = {
    id: number;
    left: number;
    size: number;
    color: string;
    duration: number;
    delay: number;
    drift: number;
    rotation: number;
};

const CONFETTI_COLORS = ['#EF2964', '#00C09D', '#2D87B0', '#EFFF1D', '#7C3AED', '#F97316'];

interface QuickActionsCardProps {
    onAddLead: () => void;
    onAddProperty: () => void;
    onAddViewing: () => void;
    onAddTask: (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName'>) => void;
    contacts: Contact[];
    realizedCommissionThisMonth: number;
    viewings: Viewing[];
    properties: Property[];
    agencyName?: string | null;
    displayName: string;
    activeBuyersEvolutionData: ActiveBuyersEvolutionData[];
}

export function QuickActionsCard({ onAddLead, onAddProperty, onAddViewing, onAddTask, contacts, realizedCommissionThisMonth, viewings, properties, agencyName, displayName, activeBuyersEvolutionData }: QuickActionsCardProps) {
    const [confettiParticles, setConfettiParticles] = useState<ConfettiParticle[]>([]);
    const timeoutIdsRef = useRef<number[]>([]);
    const particleIdRef = useRef(0);
    const confettiIntervalRef = useRef<number | null>(null);

    const clearConfettiTimers = () => {
        timeoutIdsRef.current.forEach((id) => window.clearTimeout(id));
        timeoutIdsRef.current = [];
    };

    const clearConfettiInterval = () => {
        if (confettiIntervalRef.current !== null) {
            window.clearInterval(confettiIntervalRef.current);
            confettiIntervalRef.current = null;
        }
    };

    const spawnConfettiBurst = (count: number) => {
        const nextParticles = Array.from({ length: count }, () => ({
            id: particleIdRef.current++,
            left: Math.random() * 100,
            size: Math.floor(Math.random() * 6) + 6,
            color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
            duration: 1400 + Math.random() * 1500,
            delay: Math.random() * 250,
            drift: -90 + Math.random() * 180,
            rotation: -220 + Math.random() * 440,
        }));

        const idsToRemove = new Set(nextParticles.map((particle) => particle.id));
        setConfettiParticles((current) => [...current, ...nextParticles]);

        const removeTimerId = window.setTimeout(() => {
            setConfettiParticles((current) => current.filter((particle) => !idsToRemove.has(particle.id)));
        }, 3600);

        timeoutIdsRef.current.push(removeTimerId);
    };

    useEffect(() => {
        return () => {
            clearConfettiInterval();
            clearConfettiTimers();
        };
    }, []);

    useEffect(() => {
        if (realizedCommissionThisMonth > 0) {
            if (confettiIntervalRef.current === null) {
                spawnConfettiBurst(18);
                confettiIntervalRef.current = window.setInterval(() => {
                    spawnConfettiBurst(4);
                }, 220);
            }
            return;
        }

        clearConfettiInterval();
        clearConfettiTimers();
        setConfettiParticles([]);
    }, [realizedCommissionThisMonth]);

    return (
        <Card className="agentfinder-dashboard-card agentfinder-dashboard-quick-card relative overflow-hidden bg-[#152a47] text-white border-none rounded-2xl shadow-2xl shadow-black/20">
            {realizedCommissionThisMonth > 0 && (
                <div className="agentfinder-dashboard-confetti-layer" aria-hidden="true">
                    {confettiParticles.map((particle) => {
                        const style = {
                            left: `${particle.left}%`,
                            width: `${particle.size}px`,
                            height: `${particle.size * 0.55}px`,
                            backgroundColor: particle.color,
                            animationDuration: `${particle.duration}ms`,
                            animationDelay: `${particle.delay}ms`,
                            '--agentfinder-confetti-drift': `${particle.drift}px`,
                            '--agentfinder-confetti-rotation': `${particle.rotation}deg`,
                        } as CSSProperties;

                        return <span key={particle.id} className="agentfinder-dashboard-confetti-piece" style={style} />;
                    })}
                </div>
            )}
            <CardContent className="relative z-[1] p-4 space-y-4">
                <div className="text-center">
                    <h1 className="text-xl font-bold text-white">
                        {`Bună ${displayName}, de la ${agencyName}!`}
                    </h1>
                    <p className="text-sm text-white/70">
                        Iată o privire de ansamblu asupra activităților.
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-sm text-white/70">Comision luna aceasta</p>
                    <p className="text-3xl font-bold">€{realizedCommissionThisMonth.toLocaleString('ro-RO')}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        className="agentfinder-dashboard-primary-button h-auto py-3 text-sm rounded-lg text-white font-semibold border-none"
                        onClick={onAddLead}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Cumpărător
                    </Button>
                    <Button
                        className="agentfinder-dashboard-violet-button h-auto py-3 text-sm rounded-lg text-white font-semibold border-none"
                        onClick={onAddProperty}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Proprietate
                    </Button>
                    <AddTaskDialog onAddTask={onAddTask} contacts={contacts}>
                        <Button className="agentfinder-dashboard-soft-button h-auto py-3 bg-white/10 hover:bg-white/20 text-white w-full text-sm rounded-lg">
                            <Plus className="mr-2 h-4 w-4" />
                            Task
                        </Button>
                    </AddTaskDialog>
                    <Button className="agentfinder-dashboard-soft-button h-auto py-3 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg" onClick={onAddViewing}>
                        <Plus className="mr-2 h-4 w-4" />
                        Vizionare
                    </Button>
                </div>

                <div className="pt-4">
                    <Separator className="bg-white/10 mb-4" />
                    <h3 className="text-base font-semibold text-center mb-2 text-white">Evoluție Cumpărători Activi</h3>
                    <ActiveBuyersChart data={activeBuyersEvolutionData} />
                </div>

                <div className="pt-2">
                    <div className="agentfinder-dashboard-section-label text-white text-center p-3 rounded-lg font-semibold mb-2">
                        Vizionări Programate
                    </div>
                    {viewings.length === 0 ? (
                        <p className="text-white/70 text-center py-4 text-sm">Nicio viziune programată.</p>
                    ) : (
                        <div className="space-y-2">
                            {viewings.slice(0, 3).map((viewing) => {
                                const viewingDate = parseISO(viewing.viewingDate);
                                const isViewingToday = isToday(viewingDate);
                                return (
                                    <div key={viewing.id} className="agentfinder-dashboard-list-item p-3 rounded-lg border border-white/10 bg-white/5">
                                        <div className="flex justify-between items-start gap-2">
                                            <Link href={`/properties/${viewing.propertyId}`} className="font-semibold text-sm truncate pr-2 flex-1 text-white hover:underline min-w-0">{viewing.propertyTitle}</Link>
                                            <div className="font-bold text-sm flex items-center gap-1 shrink-0 text-white/90">
                                                {isViewingToday ? (
                                                    <Clock className="h-3 w-3" />
                                                ) : (
                                                    <Calendar className="h-3 w-3" />
                                                )}
                                                {isViewingToday ? format(viewingDate, 'HH:mm') : format(viewingDate, 'd MMM', { locale: ro })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <Button
                                asChild
                                className="agentfinder-dashboard-soft-button mt-3 h-11 w-full rounded-xl border border-white/10 bg-white/10 text-white hover:bg-white/20"
                            >
                                <Link href="/viewings">Vezi toate vizionările</Link>
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
