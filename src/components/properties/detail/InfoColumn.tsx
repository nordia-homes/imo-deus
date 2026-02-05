
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutList, Users, FileText, Settings, CalendarCheck, ArrowRight } from "lucide-react";
import type { Property, Contact, Viewing } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { MatchedLeadsTab } from "./MatchedLeadsTab";
import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import Link from 'next/link';
import { RlvTab } from "./RlvTab";

export function InfoColumn({ property, allContacts, viewings }: { property: Property, allContacts: Contact[], viewings: Viewing[] }) {
    
    const scheduledViewings = (viewings || []).filter(v => v.status === 'scheduled').sort((a,b) => parseISO(a.viewingDate).getTime() - parseISO(b.viewingDate).getTime());

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
                        Cumpărători
                    </TabsTrigger>
                    <TabsTrigger value="viewings" className="h-12 rounded-lg border bg-card text-card-foreground shadow-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl">
                        <CalendarCheck className="mr-2 h-4 w-4" />
                        Vizionări
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="h-12 rounded-lg border bg-card text-card-foreground shadow-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl">
                        <FileText className="mr-2 h-4 w-4" />
                        RLV
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="h-12 rounded-lg border bg-card text-card-foreground shadow-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl">
                        <Settings className="mr-2 h-4 w-4" />
                        Setări
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-6">
                    <Card className="rounded-2xl shadow-2xl bg-[#f8f8f9]">
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
                <TabsContent value="leads" className="mt-6">
                    <MatchedLeadsTab property={property} allContacts={allContacts} />
                </TabsContent>
                <TabsContent value="viewings" className="mt-6">
                    <Card className="rounded-2xl shadow-2xl bg-[#f8f8f9]">
                        <CardHeader><CardTitle>Vizionări Programate</CardTitle></CardHeader>
                        <CardContent>
                            {scheduledViewings.length > 0 ? (
                                <div className="space-y-3">
                                    {scheduledViewings.map(viewing => (
                                        <div key={viewing.id} className="flex items-center justify-between p-3 rounded-lg border">
                                            <div>
                                                <p className="font-semibold text-sm">{viewing.contactName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {format(parseISO(viewing.viewingDate), "eeee, d MMMM yyyy 'la' HH:mm", { locale: ro })}
                                                </p>
                                            </div>
                                            <Button asChild variant="ghost" size="sm">
                                                <Link href={`/leads/${viewing.contactId}`}>
                                                    Vezi Cumpărător
                                                    <ArrowRight className="ml-2 h-4 w-4" />
                                                </Link>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-center py-8">Nicio vizionare programată pentru această proprietate.</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="documents" className="mt-6">
                    <RlvTab property={property} />
                </TabsContent>
                <TabsContent value="settings"><p>Setări proprietate</p></TabsContent>
            </Tabs>
        </div>
    )
}
