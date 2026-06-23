import { useState } from 'react';
import { useStaticAuth } from '@/hooks/use-static-auth';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, ShoppingBag, Truck, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MobileBackButton } from '@/components/MobileBackButton';

type PhoneStep = 'phone' | 'otp';

export default function AuthPage() {
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isPending, setIsPending] = useState(false);

  const { sendOtp, verifyOtp } = useStaticAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      toast({ variant: 'destructive', title: 'Invalid Phone', description: 'Please enter a valid phone number' });
      return;
    }

    setIsPending(true);
    try {
      const result = await sendOtp(phone);
      if (result.success) {
        toast({ title: 'OTP Sent!', description: result.message });
        setPhoneStep('otp');
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast({ variant: 'destructive', title: 'Invalid OTP', description: 'Please enter the 6-digit OTP' });
      return;
    }

    setIsPending(true);
    try {
      const result = await verifyOtp(phone, otp);
      if (result.success) {
        if (result.isNewUser) {
          setLocation(`/register?phone=${encodeURIComponent(phone)}&verified=true`);
        } else {
          toast({ title: 'Welcome back!', description: 'Successfully logged in.' });
          setLocation('/');
        }
      } else {
        toast({ variant: 'destructive', title: 'Verification Failed', description: result.message });
      }
    } finally {
      setIsPending(false);
    }
  };

  const resetPhoneFlow = () => {
    setPhoneStep('phone');
    setOtp('');
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex flex-col justify-center p-8 md:p-12 lg:p-16 bg-white">
        <div className="max-w-md mx-auto w-full space-y-8">
          <MobileBackButton to="/" label="Back to Shop" />
          <div className="space-y-3">
            <Link href="/" className="text-3xl font-display font-extrabold text-primary tracking-tight block mb-8">
              Freshlyn<span className="text-foreground">Nature</span>
            </Link>

            {phoneStep === 'phone' ? (
              <>
                <h1 className="text-3xl font-bold tracking-tight">Login or Sign Up</h1>
                <p className="text-muted-foreground text-lg">
                  Enter your phone number to login or create a new account
                </p>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold tracking-tight">Verify your number</h1>
                <p className="text-muted-foreground text-lg">
                  Enter the code we sent to +91 {phone}
                </p>
              </>
            )}
          </div>

          {phoneStep === 'phone' ? (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="phone" className="text-base font-medium">Phone Number</Label>
                <div className="flex gap-2">
                  <div className="flex items-center px-4 bg-muted rounded-xl text-sm font-semibold border border-input h-12">
                    +91
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="h-12 rounded-xl flex-1 text-base"
                    maxLength={10}
                    required
                    data-testid="input-phone"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-bold rounded-xl"
                disabled={isPending || phone.length < 10}
                data-testid="button-send-otp"
              >
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending OTP...</>
                ) : (
                  'Continue'
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>

              <div className="text-center pt-2">
                <p className="text-sm text-muted-foreground">
                  New to FreshlynNature? <span className="text-primary font-semibold">We'll help you create an account</span>
                </p>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <button
                type="button"
                onClick={resetPhoneFlow}
                className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline transition-colors"
                data-testid="button-back-phone"
              >
                <ArrowLeft size={16} />
                Change number
              </button>

              <div className="space-y-3">
                <Label htmlFor="otp" className="text-base font-medium">Enter 6-digit OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="------"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="h-14 rounded-xl text-center text-2xl tracking-[0.5em] font-mono"
                  maxLength={6}
                  required
                  autoFocus
                  data-testid="input-otp"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-bold rounded-xl"
                disabled={isPending || otp.length !== 6}
                data-testid="button-verify-otp"
              >
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                ) : (
                  'Verify & Continue'
                )}
              </Button>

              <div className="text-center">
                <span className="text-sm text-muted-foreground">Didn't receive the code? </span>
                <button
                  type="button"
                  onClick={(e) => handleSendOtp(e as any)}
                  className="text-sm text-primary font-semibold hover:underline"
                  data-testid="button-resend-otp"
                >
                  Resend
                </button>
              </div>
            </form>
          )}

          <div className="pt-6 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-2">
                <div className="w-10 h-10 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">Fast Delivery</p>
              </div>
              <div className="space-y-2">
                <div className="w-10 h-10 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">Fresh Products</p>
              </div>
              <div className="space-y-2">
                <div className="w-10 h-10 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">Secure Payments</p>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <p className="font-medium mb-1">Demo Mode</p>
            <p>OTP will appear in browser console (F12)</p>
          </div>
        </div>
      </div>

      <div className="hidden lg:block bg-gradient-to-br from-primary/90 to-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative h-full flex flex-col justify-center p-16">
          <div className="text-white space-y-8 max-w-lg">
            <h2 className="text-5xl font-display font-bold leading-tight">
              Fresh groceries delivered in minutes
            </h2>
            <p className="text-xl text-white/80">
              Shop from thousands of products and get them delivered to your doorstep. Quick, easy, and reliable.
            </p>
            <div className="flex gap-8 pt-4">
              <div className="space-y-1">
                <p className="text-4xl font-bold">10k+</p>
                <p className="text-sm text-white/70">Products</p>
              </div>
              <div className="space-y-1">
                <p className="text-4xl font-bold">30min</p>
                <p className="text-sm text-white/70">Delivery</p>
              </div>
              <div className="space-y-1">
                <p className="text-4xl font-bold">50k+</p>
                <p className="text-sm text-white/70">Happy Customers</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
