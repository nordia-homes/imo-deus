'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const contracts = [
    {
        title: "Contract de Rezervare",
        description: "Formular online pentru rezervarea unei proprietăți.",
        href: "https://docs.google.com/forms/d/e/1FAIpQLSdZSgZhCcfJVneX6cRL3I5LiUlFZVD9BNUPV9CQhGWBnezTsg/viewform",
        external: true,
    },
    {
        title: "Contract de Colaborare",
        description: "Model de contract pentru colaborarea între agenții.",
        href: "#",
        external: true,
        disabled: true,
    },
    {
        title: "Contract de Exclusivitate",
        description: "Model de contract pentru reprezentare exclusivă.",
        href: "#",
        external: true,
        disabled: true,
    }
];


export default function ContractsPage() {

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline font-bold">Documente și Contracte</h1>
                <p className="text-muted-foreground">
                    Accesează modelele de contracte și documentele standard ale agenției.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {contracts.map((contract) => (
                     <Card key={contract.title}>
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <div className="bg-muted p-3 rounded-lg">
                                    <FileText className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <CardTitle>{contract.title}</CardTitle>
                                    <CardDescription>{contract.description}</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <Button asChild className="w-full" disabled={contract.disabled}>
                                <Link href={contract.href} target="_blank" rel="noopener noreferrer">
                                    Deschide Documentul
                                    <ArrowUpRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
             <p className="text-sm text-muted-foreground pt-4">
                Notă: Link-urile pentru "Contract de Colaborare" și "Contract de Exclusivitate" vor fi adăugate ulterior, conform solicitării dumneavoastră.
            </p>
        </div>
    );
}
