import { useState, useEffect } from 'react';
import { useStaticAuth } from '@/hooks/use-static-auth';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MapPin, User, Phone, Mail, Home, Building2, Navigation, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { UserAddress } from '@/data/users';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const [address, setAddress] = useState<Omit<UserAddress, 'id' | 'label' | 'is_default'>>({
    flat_house: '', building: '', street: '', landmark: '', city: '', state: '', pincode: '',
  });

  const { sendOtp, verifyOtp, registerWithPhone } = useStaticAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const phoneParam = params.get('phone');
    const verifiedParam = params.get('verified');
    if (phoneParam) {
      setPhone(phoneParam.replace(/\D/g, '').slice(-10));
      if (verifiedParam === 'true') setOtpVerified(true);
    }
  }, []);

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      toast({ variant: 'destructive', title: 'Invalid Phone', description: 'Please enter a valid 10-digit phone number' });
      return;
    }
    setIsPending(true);
    try {
      const result = await sendOtp(phone);
      if (result.success) {
        toast({ title: 'OTP Sent!', description: result.message });
        setOtpSent(true);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      toast({ variant: 'destructive', title: 'Invalid OTP', description: 'Please enter the 6-digit OTP' });
      return;
    }
    setIsPending(true);
    try {
      const result = await verifyOtp(phone, otp);
      if (result.success) {
        if (!result.isNewUser && result.user) {
          toast({ title: 'Account exists!', description: 'You already have an account. Logging you in...' });
          setLocation('/');
          return;
        }
        toast({ title: 'Phone verified!', description: 'Now complete your profile.' });
        setOtpVerified(true);
      } else {
        toast({ variant: 'destructive', title: 'Verification Failed', description: result.message });
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if ('geolocation' in navigator) {
      toast({ title: 'Getting location...', description: 'Please allow location access' });
      navigator.geolocation.getCurrentPosition(
        () => {
          setAddress((prev) => ({ ...prev, city: 'Mumbai', state: 'Maharashtra', pincode: '400001' }));
          toast({ title: 'Location detected!', description: 'Please verify and add your complete address' });
        },
        () => {
          toast({ variant: 'destructive', title: 'Location Error', description: 'Could not get your location. Please enter manually.' });
        },
      );
    } else {
      toast({ variant: 'destructive', title: 'Not Supported', description: 'Location is not supported in your browser' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Name Required', description: 'Please enter your name' });
      return;
    }
    if (!address.flat_house || !address.street || !address.city || !address.pincode) {
      toast({ variant: 'destructive', title: 'Address Required', description: 'Please fill in all required address fields' });
      return;
    }
    setIsPending(true);
    try {
      await registerWithPhone({ name: name.trim(), phone: `+91${phone}`, email: email.trim() || undefined, address });
      toast({ title: 'Welcome to FreshlynNature!', description: 'Your account has been created.' });
      setLocation('/');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Registration Failed', description: error.message });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/login" className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors" data-testid="button-back">
            <ArrowLeft size={20} />
          </Link>
          <Link href="/" className="text-2xl font-display font-extrabold text-primary tracking-tight">
            Freshlyn<span className="text-foreground">Nature</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-white rounded-2xl shadow-sm border border-border p-6 md:p-8">
          <div className="space-y-2 mb-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Create your account</h1>
            <p className="text-muted-foreground">Fill in your details to start ordering fresh groceries</p>
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
                    <div className="flex items-center px-4 bg-muted rounded-xl text-sm font-medium border border-input">+91</div>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter 10-digit number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="h-11 rounded-xl flex-1"
                      maxLength={10}
                      disabled={otpVerified}
                      required
                      data-testid="input-phone"
                    />
                    {!otpSent && !otpVerified && (
                      <Button type="button" onClick={handleSendOtp} disabled={isPending || phone.length < 10} className="rounded-xl px-6" data-testid="button-send-otp">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Get OTP'}
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
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="h-11 rounded-xl flex-1 text-center tracking-widest font-mono"
                        maxLength={6}
                        autoFocus
                        data-testid="input-otp"
                      />
                      <Button type="button" onClick={handleVerifyOtp} disabled={isPending || otp.length !== 6} className="rounded-xl px-6" data-testid="button-verify-otp">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                      </Button>
                    </div>
                    <button type="button" onClick={handleSendOtp} className="text-sm text-primary font-medium hover:underline" data-testid="button-resend-otp">
                      Resend OTP
                    </button>
                  </div>
                )}

                {otpVerified && (
                  <div className="flex items-center gap-2 text-sm text-primary font-medium bg-primary/10 px-3 py-2 rounded-lg">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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
                      <Input id="name" placeholder="Enter your full name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" required data-testid="input-name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email <span className="text-muted-foreground">(Optional)</span></Label>
                      <div className="relative">
                        <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl pl-10" data-testid="input-email" />
                      </div>
                      <p className="text-xs text-muted-foreground">For order updates and offers</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <MapPin size={20} className="text-primary" />
                      Delivery Address
                    </h2>
                    <Button type="button" variant="outline" size="sm" onClick={handleUseCurrentLocation} className="rounded-xl gap-2" data-testid="button-use-location">
                      <Navigation size={14} />
                      Use current location
                    </Button>
                  </div>

                  <div className="grid gap-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="flat">Flat / House No. *</Label>
                        <div className="relative">
                          <Home size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input id="flat" placeholder="e.g., Flat 4B, House 123" value={address.flat_house} onChange={(e) => setAddress((p) => ({ ...p, flat_house: e.target.value }))} className="h-11 rounded-xl pl-10" required data-testid="input-flat" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="building">Building / Society Name</Label>
                        <div className="relative">
                          <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input id="building" placeholder="e.g., Sunrise Apartments" value={address.building} onChange={(e) => setAddress((p) => ({ ...p, building: e.target.value }))} className="h-11 rounded-xl pl-10" data-testid="input-building" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="street">Street / Area *</Label>
                      <Textarea id="street" placeholder="e.g., 123 Main Street, Sector 5" value={address.street} onChange={(e) => setAddress((p) => ({ ...p, street: e.target.value }))} className="rounded-xl min-h-[60px] resize-none" required data-testid="input-street" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="landmark">Landmark</Label>
                      <Input id="landmark" placeholder="e.g., Near Central Park, Opposite Metro Station" value={address.landmark} onChange={(e) => setAddress((p) => ({ ...p, landmark: e.target.value }))} className="h-11 rounded-xl" data-testid="input-landmark" />
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input id="city" placeholder="e.g., Mumbai" value={address.city} onChange={(e) => setAddress((p) => ({ ...p, city: e.target.value }))} className="h-11 rounded-xl" required data-testid="input-city" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State *</Label>
                        <Input id="state" placeholder="e.g., Maharashtra" value={address.state} onChange={(e) => setAddress((p) => ({ ...p, state: e.target.value }))} className="h-11 rounded-xl" required data-testid="input-state" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pincode">Pincode *</Label>
                        <Input id="pincode" placeholder="e.g., 400001" value={address.pincode} onChange={(e) => setAddress((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} className="h-11 rounded-xl" maxLength={6} required data-testid="input-pincode" />
                      </div>
                    </div>
                  </div>
                </section>

                <Button type="submit" className="w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/20" disabled={isPending} data-testid="button-register">
                  {isPending ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creating Account...</>
                  ) : (
                    'Create Account & Start Shopping'
                  )}
                </Button>
              </>
            )}
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/login" className="font-bold text-primary hover:underline" data-testid="link-login">Sign in</Link>
          </div>

          <div className="mt-6 text-center text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <p className="font-medium mb-1">Demo Mode</p>
            <p>Enter any 10-digit phone number. Check browser console for OTP.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
