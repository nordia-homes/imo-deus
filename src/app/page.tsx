import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
        Welcome to EstateFlow
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Your AI-First Real Estate CRM Platform.
      </p>
      <Button asChild className="mt-8">
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    </div>
  );
}
