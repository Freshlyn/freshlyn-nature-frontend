import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { UserAddress } from '@/data/users';
import { useStaticAuth } from '@/hooks/use-static-auth';
import { MapPin, Plus, Check, Trash2, Home, Briefcase, Tag } from 'lucide-react';

interface AddressModalProps {
  open: boolean;
  onClose: () => void;
  selectedAddressId?: string;
  onSelectAddress: (address: UserAddress) => void;
}

const LABEL_OPTIONS = ['Home', 'Work', 'Other'];

function getLabelIcon(label: string) {
  switch (label.toLowerCase()) {
    case 'home': return <Home size={14} />;
    case 'work': return <Briefcase size={14} />;
    default: return <Tag size={14} />;
  }
}

export function AddressModal({ open, onClose, selectedAddressId, onSelectAddress }: AddressModalProps) {
  const { user, addAddress, deleteAddress, setDefaultAddress } = useStaticAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('Home');
  const [newAddress, setNewAddress] = useState({
    flat_house: '', building: '', street: '', landmark: '', city: '', state: '', pincode: '',
  });

  if (!user) return null;

  const handleAddAddress = async () => {
    if (!newAddress.flat_house || !newAddress.street || !newAddress.city || !newAddress.pincode) return;
    const addr = await addAddress({ label: newLabel, is_default: user.addresses.length === 0, ...newAddress });
    if (addr) onSelectAddress(addr);
    setShowAddForm(false);
    setNewAddress({ flat_house: '', building: '', street: '', landmark: '', city: '', state: '', pincode: '' });
    setNewLabel('Home');
  };

  const handleSelect = (addr: UserAddress) => {
    setDefaultAddress(addr.id);
    onSelectAddress(addr);
    onClose();
  };

  const handleDelete = async (addressId: string) => {
    const isSelected = selectedAddressId === addressId;
    await deleteAddress(addressId);
    if (isSelected && user) {
      const remaining = user.addresses.filter((a) => a.id !== addressId);
      const newDefault = remaining.find((a) => a.is_default) || remaining[0];
      if (newDefault) onSelectAddress(newDefault);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin size={20} className="text-primary" />
            Delivery Address
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {user.addresses.map((addr) => (
            <Card
              key={addr.id}
              className={`p-3 cursor-pointer transition-all ${selectedAddressId === addr.id ? 'border-primary ring-1 ring-primary/30' : 'hover:shadow-md'}`}
              onClick={() => handleSelect(addr)}
              data-testid={`address-card-${addr.id}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedAddressId === addr.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {selectedAddressId === addr.id ? <Check size={16} /> : getLabelIcon(addr.label)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{addr.label}</span>
                    {addr.is_default && <Badge variant="outline" className="text-[10px] h-4 px-1.5">Default</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {[addr.flat_house, addr.building, addr.street, addr.landmark, addr.city, `${addr.state} ${addr.pincode}`].filter(Boolean).join(', ')}
                  </p>
                </div>
                {user.addresses.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 text-muted-foreground"
                    onClick={(e) => { e.stopPropagation(); handleDelete(addr.id); }}
                    data-testid={`button-delete-address-${addr.id}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </Card>
          ))}

          {!showAddForm ? (
            <Button variant="outline" className="w-full gap-2" onClick={() => setShowAddForm(true)} data-testid="button-add-new-address">
              <Plus size={16} />
              Add New Address
            </Button>
          ) : (
            <Card className="p-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Plus size={16} className="text-primary" />
                New Address
              </h4>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs mb-1.5 block">Address Label</Label>
                  <div className="flex gap-2">
                    {LABEL_OPTIONS.map((label) => (
                      <Button key={label} type="button" variant={newLabel === label ? 'default' : 'outline'} size="sm" onClick={() => setNewLabel(label)} className="gap-1.5" data-testid={`button-label-${label.toLowerCase()}`}>
                        {getLabelIcon(label)}
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-flat" className="text-xs">Flat / House No. *</Label>
                    <Input id="new-flat" placeholder="e.g., Flat 4B" value={newAddress.flat_house} onChange={(e) => setNewAddress((p) => ({ ...p, flat_house: e.target.value }))} data-testid="input-new-flat" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-building" className="text-xs">Building Name</Label>
                    <Input id="new-building" placeholder="e.g., Sunrise Apts" value={newAddress.building} onChange={(e) => setNewAddress((p) => ({ ...p, building: e.target.value }))} data-testid="input-new-building" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-street" className="text-xs">Street / Area *</Label>
                  <Textarea id="new-street" placeholder="e.g., 123 Main Street" value={newAddress.street} onChange={(e) => setNewAddress((p) => ({ ...p, street: e.target.value }))} className="min-h-[50px] resize-none" data-testid="input-new-street" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-landmark" className="text-xs">Landmark</Label>
                  <Input id="new-landmark" placeholder="e.g., Near Central Park" value={newAddress.landmark} onChange={(e) => setNewAddress((p) => ({ ...p, landmark: e.target.value }))} data-testid="input-new-landmark" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-city" className="text-xs">City *</Label>
                    <Input id="new-city" placeholder="Mumbai" value={newAddress.city} onChange={(e) => setNewAddress((p) => ({ ...p, city: e.target.value }))} data-testid="input-new-city" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-state" className="text-xs">State *</Label>
                    <Input id="new-state" placeholder="Maharashtra" value={newAddress.state} onChange={(e) => setNewAddress((p) => ({ ...p, state: e.target.value }))} data-testid="input-new-state" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-pincode" className="text-xs">Pincode *</Label>
                    <Input id="new-pincode" placeholder="400001" value={newAddress.pincode} onChange={(e) => setNewAddress((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} maxLength={6} data-testid="input-new-pincode" />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => { setShowAddForm(false); setNewAddress({ flat_house: '', building: '', street: '', landmark: '', city: '', state: '', pincode: '' }); }} data-testid="button-cancel-add-address">
                    Cancel
                  </Button>
                  <Button type="button" size="sm" className="flex-1" disabled={!newAddress.flat_house || !newAddress.street || !newAddress.city || !newAddress.pincode} onClick={handleAddAddress} data-testid="button-save-address">
                    Save Address
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
