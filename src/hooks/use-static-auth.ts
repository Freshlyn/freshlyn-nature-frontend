import { useCallback, useSyncExternalStore } from 'react';
import type { User, UserAddress } from '@/data/users';
import { users, getUserByEmail, getUserByPhone, getDefaultAddress } from '@/data/users';

let currentUser: User | null = null;
let listeners: Set<() => void> = new Set();
let pendingOtp: { phone: string; otp: string; expiresAt: number } | null = null;

function emitChange() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return currentUser;
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function useStaticAuth() {
  const user = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const login = useCallback(async (email: string, _password: string) => {
    await new Promise((r) => setTimeout(r, 300));
    let found = getUserByEmail(email);
    if (found) {
      currentUser = found;
      emitChange();
      return found;
    }
    const newUser: User = {
      id: `usr_${Date.now()}`,
      email,
      name: email.split('@')[0],
      phone: '',
      addresses: [],
      created_at: new Date().toISOString(),
    };
    users.push(newUser);
    currentUser = newUser;
    emitChange();
    return newUser;
  }, []);

  const sendOtp = useCallback(async (phone: string): Promise<{ success: boolean; message: string }> => {
    await new Promise((r) => setTimeout(r, 500));
    const otp = generateOtp();
    pendingOtp = {
      phone: phone.replace(/\s+/g, '').replace(/-/g, ''),
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    console.log(`[Demo] OTP for ${phone}: ${otp}`);
    return { success: true, message: `OTP sent to ${phone}. (Demo: Check console for OTP: ${otp})` };
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, otp: string): Promise<{ success: boolean; user?: User; isNewUser: boolean; message: string }> => {
      await new Promise((r) => setTimeout(r, 300));
      const normalizedPhone = phone.replace(/\s+/g, '').replace(/-/g, '');

      if (!pendingOtp || pendingOtp.phone !== normalizedPhone) {
        return { success: false, isNewUser: false, message: 'Please request a new OTP' };
      }
      if (Date.now() > pendingOtp.expiresAt) {
        pendingOtp = null;
        return { success: false, isNewUser: false, message: 'OTP has expired. Please request a new one.' };
      }
      if (pendingOtp.otp !== otp) {
        return { success: false, isNewUser: false, message: 'Invalid OTP. Please try again.' };
      }

      pendingOtp = null;
      const existing = getUserByPhone(phone);
      if (existing) {
        currentUser = existing;
        emitChange();
        return { success: true, user: existing, isNewUser: false, message: 'Login successful!' };
      }
      return { success: true, isNewUser: true, message: 'OTP verified. Please complete registration.' };
    },
    [],
  );

  const registerWithPhone = useCallback(
    async (data: {
      name: string;
      phone: string;
      email?: string;
      address: Omit<UserAddress, 'id' | 'label' | 'is_default'>;
    }): Promise<User> => {
      await new Promise((r) => setTimeout(r, 300));
      const newAddress: UserAddress = {
        id: `addr_${Date.now()}`,
        label: 'Home',
        ...data.address,
        is_default: true,
      };
      const newUser: User = {
        id: `usr_${Date.now()}`,
        email: data.email || null,
        name: data.name,
        phone: data.phone.replace(/\s+/g, '').replace(/-/g, ''),
        addresses: [newAddress],
        created_at: new Date().toISOString(),
      };
      users.push(newUser);
      currentUser = newUser;
      emitChange();
      return newUser;
    },
    [],
  );

  const register = useCallback(async (email: string, _password: string, name?: string) => {
    await new Promise((r) => setTimeout(r, 300));
    const newUser: User = {
      id: `usr_${Date.now()}`,
      email,
      name: name || email.split('@')[0],
      phone: '',
      addresses: [],
      created_at: new Date().toISOString(),
    };
    users.push(newUser);
    currentUser = newUser;
    emitChange();
    return newUser;
  }, []);

  const logout = useCallback(() => {
    currentUser = null;
    emitChange();
  }, []);

  const addAddress = useCallback(async (address: Omit<UserAddress, 'id'>) => {
    if (!currentUser) return;
    const newAddress: UserAddress = { ...address, id: `addr_${Date.now()}` };
    let updated = [...currentUser.addresses];
    if (newAddress.is_default) {
      updated = updated.map((a) => ({ ...a, is_default: false }));
    }
    updated.push(newAddress);
    currentUser = { ...currentUser, addresses: updated };
    const idx = users.findIndex((u) => u.id === currentUser?.id);
    if (idx >= 0) users[idx] = currentUser;
    emitChange();
    return newAddress;
  }, []);

  const setDefaultAddress = useCallback(async (addressId: string) => {
    if (!currentUser) return;
    currentUser = {
      ...currentUser,
      addresses: currentUser.addresses.map((a) => ({ ...a, is_default: a.id === addressId })),
    };
    const idx = users.findIndex((u) => u.id === currentUser?.id);
    if (idx >= 0) users[idx] = currentUser;
    emitChange();
  }, []);

  const deleteAddress = useCallback(async (addressId: string) => {
    if (!currentUser) return;
    const filtered = currentUser.addresses.filter((a) => a.id !== addressId);
    if (filtered.length > 0 && !filtered.some((a) => a.is_default)) {
      filtered[0].is_default = true;
    }
    currentUser = { ...currentUser, addresses: filtered };
    const idx = users.findIndex((u) => u.id === currentUser?.id);
    if (idx >= 0) users[idx] = currentUser;
    emitChange();
  }, []);

  const getDefaultUserAddress = useCallback((): UserAddress | undefined => {
    if (!currentUser) return undefined;
    return getDefaultAddress(currentUser);
  }, []);

  return {
    user,
    isLoading: false,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    sendOtp,
    verifyOtp,
    registerWithPhone,
    addAddress,
    setDefaultAddress,
    deleteAddress,
    getDefaultUserAddress,
  };
}
