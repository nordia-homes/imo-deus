import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import React from 'react';

type StatCardProps = {
    title: string;
    value: string;
    change: string;
    changeType: 'increase' | 'decrease';
    period: string;
    icon: React.ReactNode;
}

export function StatCard({ title, value, change, changeType, period, icon }: StatCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={changeType === 'increase' ? 'success' : 'destructive'} className="text-xs">{change}</Badge>
                    <span>{period}</span>
                </div>
            </CardContent>
        </Card>
    );
}
