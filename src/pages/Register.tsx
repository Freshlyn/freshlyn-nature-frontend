import { useState, useEffect } from "react";
import { useStaticAuth } from "@/hooks/use-static-auth";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, Phone, Mail, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const { sendOtp, verifyOtp, registerWithPhone } = useStaticAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const phoneParam = params.get("phone");
    const verifiedParam = params.get("verified");
    if (phoneParam) {
      setPhone(phoneParam.replace(/\D/g, "").slice(-10));
      if (verifiedParam === "true") setOtpVerified(true);
    }
  }, []);

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      toast({
        variant: "destructive",
        title: "Invalid Phone",
        description: "Please enter a valid 10-digit phone number",
      });
      return;
    }
    setIsPending(true);
    try {
      const result = await sendOtp(phone);
      if (result.success) {
        toast({ title: "OTP Sent!", description: result.message });
        setOtpSent(true);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.message,
        });
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      toast({
        variant: "destructive",
        title: "Invalid OTP",
        description: "Please enter the 6-digit OTP",
      });
      return;
    }
    setIsPending(true);
    try {
      const result = await verifyOtp(phone, otp);
      if (result.success) {
        if (!result.isNewUser && result.user) {
          toast({
            title: "Account exists!",
            description: "You already have an account. Logging you in...",
          });
          setLocation("/");
          return;
        }
        toast({
          title: "Phone verified!",
          description: "Now complete your profile.",
        });
        setOtpVerified(true);
      } else {
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: result.message,
        });
      }
    } finally {
      setIsPending(false);
    }
  };

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
      await registerWithPhone({
        name: name.trim(),
        phone: `+91${phone}`,
        email: email.trim() || undefined,
      });
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
        <div className="flex items-center gap-2 mb-6">
          <div
            className={`h-1 flex-1 rounded-full transition-colors ${otpVerified ? "bg-primary" : "bg-primary/40"}`}
          />
          <div
            className={`h-1 flex-1 rounded-full transition-colors ${otpVerified ? "bg-primary" : "bg-muted"}`}
          />
        </div>

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
                Phone Verification
              </h2>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-4 bg-muted rounded-2xl text-sm font-medium border border-input">
                      +91
                    </div>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter 10-digit number"
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      className="h-11 rounded-2xl flex-1"
                      maxLength={10}
                      disabled={otpVerified}
                      required
                      data-testid="input-phone"
                    />
                    {!otpSent && !otpVerified && (
                      <Button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isPending || phone.length < 10}
                        className="rounded-2xl px-6"
                        data-testid="button-send-otp"
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Get OTP"
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {otpSent && !otpVerified && (
                  <div className="space-y-2">
                    <Label htmlFor="otp">Enter OTP</Label>
                    <div className="flex gap-2">
                      <Input
                        id="otp"
                        type="text"
                        placeholder="6-digit OTP"
                        value={otp}
                        onChange={(e) =>
                          setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        className="h-11 rounded-2xl flex-1 text-center tracking-widest font-mono"
                        maxLength={6}
                        autoFocus
                        data-testid="input-otp"
                      />
                      <Button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={isPending || otp.length !== 6}
                        className="rounded-2xl px-6"
                        data-testid="button-verify-otp"
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Verify"
                        )}
                      </Button>
                    </div>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="text-sm text-primary font-bold hover:underline"
                      data-testid="button-resend-otp"
                    >
                      Resend OTP
                    </button>
                  </div>
                )}

                {otpVerified && (
                  <div className="flex items-center gap-2 text-sm text-primary font-bold bg-primary/10 px-3 py-2 rounded-2xl">
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
                    Phone number verified
                  </div>
                )}
              </div>
            </section>

            {otpVerified && (
              <>
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
                        <span className="text-muted-foreground">
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
              </>
            )}
          </form>

          <div className="mt-6 text-center text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <p className="font-medium mb-1">Demo Mode</p>
            <p>
              Enter any 10-digit phone number. Check browser console for OTP.
            </p>
          </div>
      </main>
    </div>
  );
}
