'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Home } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
                 <div className="flex justify-center items-center gap-2 mb-4">
                    <Home className="text-primary h-8 w-8" />
                    <h1 className="font-headline text-3xl font-bold">
                    EstateFlow
                    </h1>
                </div>
                <CardTitle>Autentificare</CardTitle>
                <CardDescription>Introdu datele pentru a accesa platforma.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="nume@agentie.ro" required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Parolă</Label>
                    <Input id="password" type="password" required />
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
                <Button className="w-full" asChild>
                    <Link href="/dashboard">Intră în cont</Link>
                </Button>
                <p className="text-xs text-muted-foreground">
                    Ai uitat parola? <Link href="#" className="underline">Recuperează</Link>
                </p>
            </CardFooter>
        </Card>
    </div>
  );
}
