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
                <TabsList>
                    <TabsTrigger value="overview">
                        <LayoutList className="mr-2 h-4 w-4" />
                        Prezentare generală
                    </TabsTrigger>
                    <TabsTrigger value="leads">
                        <Users className="mr-2 h-4 w-4" />
                        Lead-uri
                    </TabsTrigger>
                    <TabsTrigger value="tasks">
                        <CheckSquare className="mr-2 h-4 w-4" />
                        Task-uri
                    </TabsTrigger>
                    <TabsTrigger value="documents">
                        <FileText className="mr-2 h-4 w-4" />
                        Documente
                    </TabsTrigger>
                    <TabsTrigger value="settings">
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
