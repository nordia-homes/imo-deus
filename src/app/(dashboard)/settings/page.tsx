
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
       <div>
            <h1 className="text-3xl font-headline font-bold">Setări</h1>
            <p className="text-muted-foreground">
                Configurează setările contului și ale agenției.
            </p>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Profilul Tău</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
                 <div className="space-y-2">
                    <Label htmlFor="name">Nume</Label>
                    <Input id="name" defaultValue="Mihai Ionescu" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" defaultValue="mihai.i@exemplu.ro" />
                </div>
                <Button>Salvează Profil</Button>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Setări Agenție (White-Label)</CardTitle>
                <CardDescription>Personalizează aspectul platformei pentru agenția ta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
                 <div className="space-y-2">
                    <Label htmlFor="agencyName">Nume Agenție</Label>
                    <Input id="agencyName" defaultValue="Imobiliare de Vis" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="logoUrl">URL Logo</Label>
                    <Input id="logoUrl" placeholder="https://..." />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="primaryColor">Culoare Primară</Label>
                    <Input id="primaryColor" type="color" defaultValue="#1E3A8A" className="w-24 p-1" />
                </div>
                <Button>Salvează Setări Agenție</Button>
            </CardContent>
        </Card>
    </div>
  );
}
