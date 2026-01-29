'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Home, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import type { AuthError } from "firebase/auth";
import { GoogleIcon } from "@/components/icons/GoogleIcon";


const loginSchema = z.object({
  email: z.string().email({ message: 'Adresă de email invalidă.' }),
  password: z.string().min(6, { message: 'Parola trebuie să aibă cel puțin 6 caractere.' }),
});

export default function LoginPage() {
  const { login, loginWithGoogle, isLoggedIn } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (isLoggedIn) {
      router.replace('/dashboard');
    }
  }, [isLoggedIn, router]);

  const handleLogin = (values: z.infer<typeof loginSchema>) => {
    setIsSubmitting(true);
    login(values.email, values.password, (error: AuthError) => {
        console.error("Login failed:", error);
        toast({
            variant: "destructive",
            title: "Autentificare eșuată",
            description: "Adresa de email sau parola este incorectă. Vă rugăm să încercați din nou.",
        });
        setIsSubmitting(false);
    });
  };

  const handleGoogleLogin = () => {
    setIsSubmitting(true);
    loginWithGoogle((error: AuthError) => {
        console.error("Google Login failed:", error);
        toast({
            variant: "destructive",
            title: "Autentificare eșuată",
            description: "Nu am putut finaliza autentificarea cu Google. Vă rugăm să încercați din nou.",
        });
        setIsSubmitting(false);
    });
  }

  if (isLoggedIn) {
    return null; // Or a loader while redirecting
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleLogin)} className="w-full max-w-sm">
            <Card>
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
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                    <Input type="email" placeholder="nume@agentie.ro" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center justify-between">
                                    <FormLabel>Parolă</FormLabel>
                                    <Link
                                        href="/forgot-password"
                                        className="text-xs text-muted-foreground underline hover:text-primary"
                                        tabIndex={-1}
                                    >
                                        Am uitat parola?
                                    </Link>
                                </div>
                                <FormControl>
                                    <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                    <Button className="w-full" type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Intră în cont
                    </Button>
                    <div className="relative w-full">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">
                            SAU CONTINUĂ CU
                            </span>
                        </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={isSubmitting}>
                        <GoogleIcon className="mr-2 h-4 w-4" />
                        Continuă cu Google
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        Nu ai cont? <Link href="/register" className="underline">Înregistrează-te</Link>
                    </p>
                </CardFooter>
            </Card>
        </form>
      </Form>
    </div>
  );
}
