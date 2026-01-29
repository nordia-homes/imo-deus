import { tasks } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default function TasksPage() {
    const today = new Date().toISOString().split('T')[0];
    const upcomingTasks = tasks.filter(task => !task.completed && task.dueDate >= today);
    const completedTasks = tasks.filter(task => task.completed);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-headline font-bold">Tasks</h1>
            <p className="text-muted-foreground">
                Stay on top of your to-do list.
            </p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section>
            <h2 className="text-xl font-headline font-semibold mb-4">Upcoming Tasks</h2>
            <div className="space-y-4">
                {upcomingTasks.length > 0 ? upcomingTasks.map(task => (
                    <Card key={task.id}>
                        <CardContent className="p-4 flex items-center gap-4">
                            <Checkbox id={`task-${task.id}`} />
                            <div className="flex-1">
                                <label htmlFor={`task-${task.id}`} className="font-medium cursor-pointer">{task.title}</label>
                                <p className="text-sm text-muted-foreground">
                                    Due: {task.dueDate}
                                    {task.contactName && (
                                        <>
                                         {' | For: '}
                                         <Link href={`/contacts/${task.contactId}`} className="text-primary hover:underline">
                                            {task.contactName}
                                         </Link>
                                        </>
                                    )}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )) : <p className="text-muted-foreground">No upcoming tasks. Great job!</p>}
            </div>
        </section>
        <section>
            <h2 className="text-xl font-headline font-semibold mb-4">Completed Tasks</h2>
            <div className="space-y-4">
                 {completedTasks.map(task => (
                    <Card key={task.id} className="bg-muted">
                        <CardContent className="p-4 flex items-center gap-4">
                            <Checkbox id={`task-${task.id}`} checked={true} />
                            <div className="flex-1">
                                <label htmlFor={`task-${task.id}`} className="font-medium text-muted-foreground line-through cursor-pointer">{task.title}</label>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>
      </div>
    </div>
  );
}
