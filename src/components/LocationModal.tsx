import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation } from 'lucide-react';
import { useState } from 'react';

interface LocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectLocation: (location: string) => void;
}

export function LocationModal({ open, onOpenChange, onSelectLocation }: LocationModalProps) {
  const [loading, setLoading] = useState(false);

  const handleGeolocation = () => {
    setLoading(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setTimeout(() => {
            onSelectLocation('Current Location');
            setLoading(false);
            onOpenChange(false);
          }, 1000);
        },
        () => {
          setLoading(false);
          alert('Could not access location. Please enter manually.');
        },
      );
    } else {
      setLoading(false);
      alert('Geolocation is not supported by your browser');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl rounded-3xl p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 to-transparent p-6 pb-8 text-center">
          <div className="mx-auto bg-white p-3 rounded-full w-fit shadow-md mb-4 text-primary">
            <MapPin size={32} />
          </div>
          <DialogTitle className="text-2xl font-bold font-display">Where should we deliver?</DialogTitle>
          <DialogDescription className="text-base mt-2">
            We need your location to show available products and delivery times.
          </DialogDescription>
        </div>

        <div className="p-6 pt-2 space-y-4">
          <Button size="lg" className="w-full rounded-xl gap-2 font-bold shadow-lg shadow-primary/20" onClick={handleGeolocation} disabled={loading}>
            <Navigation size={18} />
            {loading ? 'Detecting...' : 'Use Current Location'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground font-medium">Or enter manually</span>
            </div>
          </div>

          <input
            placeholder="Search for area, street name..."
            className="w-full px-4 py-3 rounded-xl border border-input bg-muted/20 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
          />

          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
              Dismiss
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
