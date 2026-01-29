'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Home, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import React, { useState } from "react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import type { AuthError } from "firebase/auth";

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Adresă de email invalidă.' }),
});

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const handleResetPassword = (values: z.infer<typeof forgotPasswordSchema>) => {
    setIsSubmitting(true);
    resetPassword(values.email, 
    () => { // onSuccess
        setIsSuccess(true);
        setIsSubmitting(false);
    }, 
    (error: AuthError) => { // onError
        console.error("Password reset failed:", error);
        toast({
            variant: "destructive",
            title: "Resetare eșuată",
            description: "Nu am putut găsi un cont cu această adresă de email.",
        });
        setIsSubmitting(false);
    });
  };
  
  if (isSuccess) {
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
                    <CardTitle>Verifică email-ul</CardTitle>
                    <CardDescription>
                        Ți-am trimis un link pentru a-ți reseta parola. Verifică și folderul Spam.
                    </CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button variant="link" className="w-full" asChild>
                        <Link href="/login">Înapoi la Autentificare</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleResetPassword)} className="w-full max-w-sm">
            <Card>
                <CardHeader className="text-center">
                     <div className="flex justify-center items-center gap-2 mb-4">
                        <Home className="text-primary h-8 w-8" />
                        <h1 className="font-headline text-3xl font-bold">
                        EstateFlow
                        </h1>
                    </div>
                    <CardTitle>Ai uitat parola?</CardTitle>
                    <CardDescription>Introdu adresa de email și îți vom trimite un link de resetare.</CardDescription>
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
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                    <Button className="w-full" type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Trimite link de resetare
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        <Link href="/login" className="underline">Înapoi la Autentificare</Link>
                    </p>
                </CardFooter>
            </Card>
        </form>
      </Form>
    </div>
  );
}
