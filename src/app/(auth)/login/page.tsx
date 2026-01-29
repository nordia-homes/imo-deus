
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Home } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = () => {
    // Placeholder for Firebase login logic
    router.push('/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <Home className="h-8 w-8 text-primary" />
             <h1 className="ml-2 text-3xl font-headline font-bold">EstateFlow</h1>
          </div>
          <CardTitle>Autentificare</CardTitle>
          <CardDescription>Introduceți datele pentru a accesa platforma</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="exemplu@email.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Parolă</Label>
              <Input id="password" type="password" required />
            </div>
            <Button onClick={handleLogin} type="submit" className="w-full">
              Intră în cont
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
