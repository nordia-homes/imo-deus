import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';

const activities = [
    { clientName: 'Sophie T.', clientAvatar: 'https://i.pravatar.cc/150?u=sophie', clientHandle: '@sophie.turner', task: 'Apartament 2 camere, Dristor', date: 'Apr 2', price: '€125,000', status: 'Draft' },
    { clientName: 'Sam S.', clientAvatar: 'https://i.pravatar.cc/150?u=sam', clientHandle: '@sam.smith', task: 'Garsonieră, Militari', date: 'Apr 1', price: '€50,000', status: 'În Progres' },
    { clientName: 'Olivia P.', clientAvatar: 'https://i.pravatar.cc/150?u=olivia', clientHandle: '@olivia.peterson', task: 'Vilă, Pipera', date: 'Apr 1', price: '€425,000', status: 'În Revizuire' },
];

function getStatusBadge(status: string) {
    switch (status) {
        case 'În Progres': return 'warning';
        case 'În Revizuire': return 'default';
        case 'Draft': return 'secondary';
        default: return 'outline';
    }
}

export function RecentActivity() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Activitate Recentă</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Client</TableHead>
                            <TableHead>Proprietate</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Preț</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {activities.map(activity => (
                            <TableRow key={activity.clientName}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={activity.clientAvatar} />
                                            <AvatarFallback>{activity.clientName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-medium">{activity.clientName}</p>
                                            <p className="text-xs text-muted-foreground">{activity.clientHandle}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>{activity.task}</TableCell>
                                <TableCell>{activity.date}</TableCell>
                                <TableCell>{activity.price}</TableCell>
                                <TableCell><Badge variant={getStatusBadge(activity.status) as any}>{activity.status}</Badge></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
