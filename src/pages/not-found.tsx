import { Link } from "wouter";
import { Compass, ArrowLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <Header />

      <main className="container mx-auto px-4 py-6 max-w-md lg:max-w-lg">
        <div className="flex flex-col items-center text-center pt-12 md:pt-20">
          <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6">
            <Compass size={36} />
          </div>

          <h1 className="text-2xl font-display font-bold" data-testid="text-notfound-title">
            This page doesn't exist
          </h1>
          <p className="text-muted-foreground mt-2 mb-8">
            The link may be broken, or the page may have moved. Let's get you back to the
            fresh stuff.
          </p>

          <Button asChild size="lg" className="rounded-full px-8">
            <Link href="/" data-testid="link-notfound-home">
              <ArrowLeft size={18} />
              Back to Shop
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
