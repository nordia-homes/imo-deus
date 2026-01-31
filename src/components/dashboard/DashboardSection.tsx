'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DashboardSectionProps {
    title: string;
    icon: React.ReactNode;
    count: number;
    children: React.ReactNode;
}

export function DashboardSection({ title, icon, count, children }: DashboardSectionProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {icon}
                        <span className="text-base font-semibold">{title}</span>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {children}
            </CardContent>
        </Card>
    );
}
