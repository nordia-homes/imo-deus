
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle } from "lucide-react";
import Link from 'next/link';


export default function TasksPage() {
    // Placeholder data
    const tasks = [
        { id: 't1', title: 'Follow up cu Alex Popescu', dueDate: '2024-06-05', completed: false, contactId: '1', contactName: 'Alex Popescu' },
        { id: 't2', title: 'Programează vizionare pentru Ana Ionescu', dueDate: '2024-06-02', completed: false, contactId: '2', contactName: 'Ana Ionescu' },
        { id: 't3', title: 'Pregătește acte vânzare proprietate #P345', dueDate: '2024-05-30', completed: true },
    ];
    const upcomingTasks = tasks.filter(task => !task.completed);
    const completedTasks = tasks.filter(task => task.completed);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-headline font-bold">Task-uri</h1>
            <p className="text-muted-foreground">
                Organizează-ți activitățile și nu rata niciun detaliu.
            </p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adaugă Task
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section>
            <h2 className="text-xl font-headline font-semibold mb-4">De făcut</h2>
            <div className="space-y-4">
                {upcomingTasks.length > 0 ? upcomingTasks.map(task => (
                    <Card key={task.id}>
                        <CardContent className="p-4 flex items-center gap-4">
                            <Checkbox id={`task-${task.id}`} />
                            <div className="flex-1">
                                <label htmlFor={`task-${task.id}`} className="font-medium cursor-pointer">{task.title}</label>
                                <p className="text-sm text-muted-foreground">
                                    Scadent: {task.dueDate}
                                    {task.contactName && (
                                        <>
                                         {' | Pentru: '}
                                         <Link href={`/leads/${task.contactId}`} className="text-primary hover:underline">
                                            {task.contactName}
                                         </Link>
                                        </>
                                    )}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )) : <p className="text-muted-foreground">Niciun task. Ești la zi!</p>}
            </div>
        </section>
        <section>
            <h2 className="text-xl font-headline font-semibold mb-4">Completate</h2>
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
