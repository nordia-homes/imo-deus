'use client';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Dot } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

type ChartData = {
    name: string;
    'Actual': number;
    'AI Projected': number;
};

const CustomDot = (props: any) => {
    const { cx, cy, stroke } = props;
    return <Dot cx={cx} cy={cy} r={4} fill={stroke} />;
};

export function SalesAnalyticsChart({ data, isLoading }: { data: ChartData[], isLoading: boolean }) {

    if (isLoading) {
        return (
            <Card className="h-full flex flex-col">
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                    <Skeleton className="flex-1 h-[250px] w-full" />
                </CardContent>
            </Card>
        )
    }

    const chartData = data && data.length > 0 ? data : [];

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                 <div>
                    <CardTitle>Analiza Veniturilor</CardTitle>
                    <CardDescription>Ultimele 30 de zile</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
                {chartData.length > 0 ? (
                    <div className='flex-1 h-[250px]'>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `€${value}`} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '0.5rem',
                                        fontSize: '12px'
                                    }}
                                />
                                <Legend iconType="circle" wrapperStyle={{fontSize: "12px"}}/>
                                <Bar dataKey="Actual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={10} />
                                <Line type="monotone" dataKey="AI Projected" stroke="hsl(var(--primary))" strokeOpacity={0.5} strokeWidth={2} dot={<CustomDot />} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="flex-1 h-[250px] flex items-center justify-center">
                         <p className="text-muted-foreground">Nu sunt date de vânzări de afișat în ultimele 30 de zile.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
