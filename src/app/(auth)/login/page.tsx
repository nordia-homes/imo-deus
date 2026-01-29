'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Home } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login, isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn) {
      router.replace('/dashboard');
    }
  }, [isLoggedIn, router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Here you would normally validate credentials against a backend
    login();
  };

  if (isLoggedIn) {
    return null; // Or a loader while redirecting
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <form onSubmit={handleLogin}>
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
                    <Input id="email" type="email" placeholder="nume@agentie.ro" required defaultValue="mihai.i@exemplu.ro" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Parolă</Label>
                    <Input id="password" type="password" required defaultValue="password" />
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
                <Button className="w-full" type="submit">
                    Intră în cont
                </Button>
                <p className="text-xs text-muted-foreground">
                    Ai uitat parola? <Link href="#" className="underline">Recuperează</Link>
                </p>
            </CardFooter>
        </Card>
      </form>
    </div>
  );
}
