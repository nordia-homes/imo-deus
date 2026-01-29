'use client';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Dot } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Lightbulb, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
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
                    <div className="mt-4">
                        <Skeleton className="h-20 w-full" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    const chartData = data && data.length > 0 ? data : [];

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Analiza Veniturilor</CardTitle>
                    <Select defaultValue="last-30-days">
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Selectează perioada" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="last-30-days">Ultimele 30 de zile</SelectItem>
                            <SelectItem value="last-3-months" disabled>Ultimele 3 luni</SelectItem>
                            <SelectItem value="last-year" disabled>Ultimul an</SelectItem>
                        </SelectContent>
                    </Select>
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
                                        backgroundColor: 'white',
                                        border: '1px solid #ccc',
                                        borderRadius: '0.5rem',
                                        fontSize: '12px'
                                    }}
                                />
                                <Legend iconType="circle" wrapperStyle={{fontSize: "12px"}}/>
                                <Bar dataKey="Actual" fill="#d1d5db" radius={[4, 4, 0, 0]} barSize={10} />
                                <Line type="monotone" dataKey="AI Projected" stroke="#8b5cf6" strokeWidth={2} dot={<CustomDot />} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="flex-1 h-[250px] flex items-center justify-center">
                         <p className="text-muted-foreground">Nu sunt date de vânzări de afișat în ultimele 30 de zile.</p>
                    </div>
                )}
                <div className="mt-4 flex items-center gap-4 rounded-lg bg-accent/50 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Lightbulb className="h-5 w-5 text-primary" />
                    </div>
                    <div className='flex-1'>
                        <p className="text-sm text-muted-foreground">O mai bună comunicare cu clienții poate crește numărul de sfaturi și repetarea afacerilor. Încercați răspunsuri și urmăriri mai rapide!</p>
                    </div>
                    <Button>Rulează Analiza</Button>
                </div>
            </CardContent>
        </Card>
    );
}
