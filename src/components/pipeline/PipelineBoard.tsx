
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";

const stages = ['Nou', 'Contactat', 'Vizionare', 'Negociere', 'Antecontract', 'Vândut'];

// Placeholder data
const deals = [
    { id: '1', clientName: 'Alex Popescu', value: 150000, probability: 70, stage: 'Vizionare' },
    { id: '2', clientName: 'Ana Ionescu', value: 250000, probability: 30, stage: 'Nou' },
    { id: '3', clientName: 'Dan Georgescu', value: 90000, probability: 85, stage: 'Negociere' },
    { id: '4', clientName: 'Maria Vasilescu', value: 320000, probability: 95, stage: 'Antecontract' },
];


function DealCard({ deal }: { deal: any }) {
    return (
        <Card className="mb-4 bg-white">
            <CardContent className="p-3">
                <p className="font-semibold">{deal.clientName}</p>
                <p className="text-sm text-muted-foreground">€{deal.value.toLocaleString()}</p>
                <Badge className="mt-2">AI Prob: {deal.probability}%</Badge>
            </CardContent>
        </Card>
    )
}

export function PipelineBoard() {
  // This would be a drag-and-drop board in a real implementation
  // For now, it's a static layout.
  return (
    <div className="flex-1 grid grid-cols-6 gap-4 overflow-x-auto">
      {stages.map(stage => (
        <div key={stage} className="bg-gray-100 rounded-lg p-3 flex flex-col">
            <h3 className="font-semibold mb-4 text-center">{stage}</h3>
            <div className="flex-1">
                {deals.filter(deal => deal.stage === stage).map(deal => (
                    <DealCard key={deal.id} deal={deal} />
                ))}
            </div>
        </div>
      ))}
    </div>
  );
}
