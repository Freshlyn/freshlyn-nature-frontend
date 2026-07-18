export interface UserAddress {
  id: string;
  label: string;
  flat_house: string;
  building: string;
  street: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

export function formatAddress(address: UserAddress | Omit<UserAddress, 'id' | 'label' | 'is_default'>): string {
  const parts = [
    address.flat_house,
    address.building,
    address.street,
    address.landmark,
    address.city,
    `${address.state} ${address.pincode}`,
  ].filter(Boolean);
  return parts.join(', ');
}

export function formatAddressShort(address: UserAddress): string {
  const parts = [address.flat_house, address.building || address.street, address.city].filter(Boolean);
  return parts.join(', ');
}
