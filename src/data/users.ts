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

export interface User {
  id: string;
  email: string | null;
  name: string;
  phone: string;
  addresses: UserAddress[];
  created_at: string;
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

export const users: User[] = [
  {
    id: 'usr_001',
    email: 'john@example.com',
    name: 'John Doe',
    phone: '+911234567890',
    addresses: [
      {
        id: 'addr_001',
        label: 'Home',
        flat_house: 'Flat 4B',
        building: 'Sunrise Apartments',
        street: '123 Main Street',
        landmark: 'Near Central Park',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        is_default: true,
      },
      {
        id: 'addr_002',
        label: 'Work',
        flat_house: 'Office 301',
        building: 'Tech Park Tower',
        street: 'IT Road',
        landmark: 'Near Metro Station',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400076',
        is_default: false,
      },
    ],
    created_at: '2024-01-10T08:00:00Z',
  },
  {
    id: 'usr_002',
    email: 'jane@example.com',
    name: 'Jane Smith',
    phone: '+919876543210',
    addresses: [
      {
        id: 'addr_003',
        label: 'Home',
        flat_house: 'House 45',
        building: '',
        street: 'Oak Avenue',
        landmark: 'Opposite Metro Station',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        is_default: true,
      },
    ],
    created_at: '2024-01-12T14:30:00Z',
  },
  {
    id: 'usr_003',
    email: null,
    name: 'Demo User',
    phone: '+919999999999',
    addresses: [
      {
        id: 'addr_004',
        label: 'Home',
        flat_house: '789',
        building: 'Demo Tower',
        street: 'Demo Lane',
        landmark: 'Near Demo Mall',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        is_default: true,
      },
    ],
    created_at: '2024-01-15T10:00:00Z',
  },
];

export function getUserById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function getUserByEmail(email: string): User | undefined {
  return users.find((u) => u.email === email);
}

export function getUserByPhone(phone: string): User | undefined {
  const normalizedInput = phone.replace(/\s+/g, '').replace(/-/g, '').replace(/^\+91/, '');
  const last10 = normalizedInput.slice(-10);
  return users.find((u) => {
    const userLast10 = u.phone.replace(/\s+/g, '').replace(/-/g, '').replace(/^\+91/, '').slice(-10);
    return userLast10 === last10;
  });
}

export function getDefaultAddress(user: User): UserAddress | undefined {
  return user.addresses.find((a) => a.is_default) || user.addresses[0];
}
