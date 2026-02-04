'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import React from 'react';

type StatCardProps = {
    title: string;
    value: string;
    period?: string;
    icon: React.ReactNode;
}

export function StatCard({ title, value, period, icon }: StatCardProps) {
    return (
        <Card className="shadow-2xl rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {period && <p className="text-xs text-muted-foreground">{period}</p>}
            </CardContent>
        </Card>
    );
}
