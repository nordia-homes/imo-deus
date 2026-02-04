'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutList, Users, CheckSquare, FileText, Settings } from "lucide-react";
import type { Property } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function InfoColumn({ property }: { property: Property }) {
    return (
        <div className="space-y-6">
            <Tabs defaultValue="overview">
                <TabsList className="grid h-auto grid-cols-2 gap-2 bg-transparent p-0 sm:grid-cols-3 md:grid-cols-5">
                    <TabsTrigger value="overview" className="h-12 rounded-lg border bg-card text-card-foreground shadow-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl">
                        <LayoutList className="mr-2 h-4 w-4" />
                        Prezentare generală
                    </TabsTrigger>
                    <TabsTrigger value="leads" className="h-12 rounded-lg border bg-card text-card-foreground shadow-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl">
                        <Users className="mr-2 h-4 w-4" />
                        Lead-uri
                    </TabsTrigger>
                    <TabsTrigger value="tasks" className="h-12 rounded-lg border bg-card text-card-foreground shadow-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl">
                        <CheckSquare className="mr-2 h-4 w-4" />
                        Task-uri
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="h-12 rounded-lg border bg-card text-card-foreground shadow-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl">
                        <FileText className="mr-2 h-4 w-4" />
                        Documente
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="h-12 rounded-lg border bg-card text-card-foreground shadow-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl">
                        <Settings className="mr-2 h-4 w-4" />
                        Setări
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-6">
                    <Card className="rounded-2xl shadow-2xl">
                        <CardHeader><CardTitle>Descriere</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground whitespace-pre-wrap">{property.description}</p>
                             {property.amenities && property.amenities.length > 0 && (
                                <div className="mt-6">
                                     <div className="flex flex-wrap gap-2">
                                        {property.amenities.map(amenity => (
                                            <Button key={amenity} variant="outline" size="sm" className="pointer-events-none cursor-default bg-muted">
                                                {amenity}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                             )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="leads"><p>Lead-uri asociate</p></TabsContent>
                <TabsContent value="tasks"><p>Task-uri asociate</p></TabsContent>
                <TabsContent value="documents"><p>Documente asociate</p></TabsContent>
                <TabsContent value="settings"><p>Setări proprietate</p></TabsContent>
            </Tabs>
        </div>
    )
}
