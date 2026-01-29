'use client';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Dot } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Lightbulb, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

// Placeholder data similar to the image
const data = [
  { name: 'Mar 1', Actual: 80, 'AI Projected': 90 },
  { name: 'Mar 5', Actual: 120, 'AI Projected': 110 },
  { name: 'Mar 10', Actual: 90, 'AI Projected': 100 },
  { name: 'Mar 14', Actual: 220, 'AI Projected': 220 },
  { name: 'Mar 15', Actual: 210, 'AI Projected': 225 },
  { name: 'Mar 20', Actual: 150, 'AI Projected': 160 },
  { name: 'Mar 25', Actual: 180, 'AI Projected': 170 },
  { name: 'Mar 31', Actual: 160, 'AI Projected': 165 },
];

const CustomDot = (props: any) => {
    const { cx, cy, stroke, payload, value } = props;
  
    if (payload.name === 'Mar 14') {
      return (
        <svg x={cx - 10} y={cy - 10} width={20} height={20} fill="white" viewBox="0 0 1024 1024">
          <circle cx={cx} cy={cy} r={8} strokeWidth="3" stroke="#8884d8" fill="#8884d8" />
        </svg>
      );
    }
  
    return <Dot cx={cx} cy={cy} r={4} fill={stroke} />;
};


export function SalesAnalyticsChart() {
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
                            <SelectItem value="last-3-months">Ultimele 3 luni</SelectItem>
                            <SelectItem value="last-year">Ultimul an</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
                <div className='flex-1 h-[250px]'>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
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
