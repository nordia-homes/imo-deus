'use client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

export default function ContractsPage() {

    const contracts = [
        {
            title: "Contract de Rezervare",
            description: "Folosește acest formular pentru a rezerva o proprietate pentru un client.",
            link: "https://docs.google.com/forms/d/e/1FAIpQLSdZSgZhCcfJVneX6cRL3I5LiUlFZVD9BNUPV9CQhGWBnezTsg/viewform",
            enabled: true,
        },
        {
            title: "Contract de Colaborare",
            description: "Document standard pentru colaborarea cu alte agenții sau parteneri.",
            link: "#",
            enabled: false,
        },
        {
            title: "Contract de Exclusivitate",
            description: "Contractul pentru obținerea reprezentării exclusive a unei proprietăți.",
            link: "#",
            enabled: false,
        }
    ];
    
    return (
        <div className="space-y-6 h-full bg-[#0F1E33] text-white p-4">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-headline font-bold text-white">Documente și Contracte</h1>
                    <p className="text-white/70">
                        Accesează documentele standard ale agenției.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {contracts.map((contract) => (
                    <Card key={contract.title} className="flex flex-col bg-[#152A47] border-none text-white rounded-2xl shadow-2xl">
                        <CardHeader>
                            <CardTitle className="text-white">{contract.title}</CardTitle>
                            <CardDescription className="text-white/70">{contract.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            {/* Empty content for spacing */}
                        </CardContent>
                        <CardFooter>
                            <Button asChild variant="outline" className="w-full bg-white/10 border-white/20 hover:bg-white/20 text-white" disabled={!contract.enabled}>
                                <Link href={contract.link} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Deschide Document
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
             <p className="text-xs text-white/70 text-center pt-4">
                Pentru a adăuga link-urile lipsă, vă rog să mi le furnizați în conversație.
            </p>
        </div>
    );
}
