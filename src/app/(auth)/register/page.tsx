'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Home, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth, useUser, useFirestore } from "@/firebase";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import type { AuthError, User } from "firebase/auth";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, deleteDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import type { Invite } from "@/lib/types";

const registerSchema = z.object({
  email: z.string().email({ message: 'Adresă de email invalidă.' }),
  password: z.string().min(6, { message: 'Parola trebuie să aibă cel puțin 6 caractere.' }),
});

export default function RegisterPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const isLoggedIn = !!user;
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
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

  const handlePostRegistration = async (newUser: User) => {
    if (!newUser.email) return;
    try {
        const inviteRef = doc(firestore, 'invites', btoa(newUser.email));
        const inviteSnap = await getDoc(inviteRef);

        if (inviteSnap.exists()) {
            // Invited user flow
            const inviteData = inviteSnap.data() as Invite;
            const userProfile = {
                name: newUser.displayName || newUser.email,
                email: newUser.email,
                agencyId: inviteData.agencyId,
                role: inviteData.role,
                agencyName: inviteData.agencyName,
                photoUrl: newUser.photoURL,
            };
            
            const userDocRef = doc(firestore, 'users', newUser.uid);
            await setDoc(userDocRef, userProfile, { merge: true }); // Use merge to be safe
            
            // Add the new user to the agency's list of agents
            const agencyRef = doc(firestore, 'agencies', inviteData.agencyId);
            await updateDoc(agencyRef, {
                agentIds: arrayUnion(newUser.uid)
            });

            await deleteDoc(inviteRef); // Consume the invite

            toast({ title: `Bun venit la ${inviteData.agencyName}!` });
        }
        // If no invite, the default flow (redirect to settings to create an agency) will happen automatically.
    } catch (error) {
        console.error("Post-registration process failed:", error);
        toast({
            variant: "destructive",
            title: "Eroare post-înregistrare",
            description: "Nu am putut finaliza configurarea contului. Vă rugăm contactați administratorul.",
        });
    }
  }

  const handleRegister = (values: z.infer<typeof registerSchema>) => {
    setIsSubmitting(true);
    createUserWithEmailAndPassword(auth, values.email, values.password)
      .then(async (userCredential) => {
            await handlePostRegistration(userCredential.user);
            // The useUser hook will detect the new user and redirect to dashboard.
      })
      .catch((error: AuthError) => {
        console.error("Registration failed:", error);
        
        let description = "A apărut o eroare. Vă rugăm să încercați din nou.";
        if (error.code === 'auth/email-already-in-use') {
            description = "Adresa de email este deja folosită de alt cont.";
        }

        toast({
            variant: "destructive",
            title: "Înregistrare eșuată",
            description: description,
        });
        setIsSubmitting(false);
    });
  };

  const handleGoogleLogin = () => {
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then(async (userCredential) => {
          await handlePostRegistration(userCredential.user);
      })
      .catch((error: AuthError) => {
        console.error("Google Login failed:", error);
        toast({
            variant: "destructive",
            title: "Autentificare eșuată",
            description: "Nu am putut finaliza autentificarea cu Google. Vă rugăm să încercați din nou.",
        });
        setIsSubmitting(false);
    });
  }

  if (isUserLoading || isLoggedIn) {
    return null; // Or a loader while redirecting
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleRegister)} className="w-full max-w-sm">
            <Card>
                <CardHeader className="text-center">
                     <div className="flex justify-center items-center gap-2 mb-4">
                        <Home className="text-primary h-8 w-8" />
                        <h1 className="font-headline text-3xl font-bold">
                        EstateFlow
                        </h1>
                    </div>
                    <CardTitle>Creează un cont nou</CardTitle>
                    <CardDescription>Introdu datele pentru a te înregistra.</CardDescription>
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
                                <FormLabel>Parolă</FormLabel>
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
                        Creează cont
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
                        Ai deja cont? <Link href="/login" className="underline">Autentifică-te</Link>
                    </p>
                </CardFooter>
            </Card>
        </form>
      </Form>
    </div>
  );
}
