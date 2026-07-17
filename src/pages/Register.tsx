import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, Phone, Mail, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);

  const { updateProfile, profile, isAuthenticated, isLoading, needsProfileCompletion } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation('/login', { replace: true });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!needsProfileCompletion) {
    setLocation('/', { replace: true });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: "Name Required",
        description: "Please enter your name",
      });
      return;
    }
    setIsPending(true);
    try {
      await updateProfile({ name: name.trim(), email: email.trim() || undefined });
      toast({
        title: "Welcome to FreshlynNature!",
        description: "Your account has been created.",
      });
      setLocation("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message,
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/login"
            className="w-9 h-9 rounded-xl border border-border bg-white flex items-center justify-center hover:bg-muted transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft size={18} />
          </Link>
          <Link href="/">
            <img
              src="/logo.png"
              alt="Freshlyn Nature"
              className="h-9 w-auto object-contain"
            />
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-5 py-8 max-w-2xl">
        <div className="space-y-2 mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Create your account
          </h1>
          <p className="text-muted-foreground">
            Just your name and you're in — add your delivery address later at
            checkout
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Phone size={20} className="text-primary" />
                Phone Number
              </h2>

              <div className="flex items-center gap-2 text-sm text-primary font-bold bg-primary/10 px-3 py-2 rounded-2xl w-fit">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                +91 {profile?.phone?.replace(/^\+?91/, "") ?? ""} verified
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <User size={20} className="text-primary" />
                Personal Details
              </h2>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <div className="relative">
                    <User
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      id="name"
                      placeholder="Enter your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-11 rounded-2xl pl-10"
                      required
                      data-testid="input-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email{" "}
                    <span className="text-muted-foreground font-normal">
                      (Optional)
                    </span>
                  </Label>
                  <div className="relative">
                    <Mail
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 rounded-2xl pl-10"
                      data-testid="input-email"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    For order updates and offers
                  </p>
                </div>
              </div>
            </section>

            <Button
              type="submit"
              className="w-full h-14 text-base font-bold rounded-2xl shadow-lg shadow-primary/20 whitespace-normal"
              disabled={isPending}
              data-testid="button-register"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creating
                  Account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
      </main>
    </div>
  );
}
