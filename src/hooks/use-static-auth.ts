import { useCallback, useSyncExternalStore } from 'react';
import type { User, UserAddress } from '@/data/users';
import { users, getDefaultAddress } from '@/data/users';

let currentUser: User | null = null;
let listeners: Set<() => void> = new Set();

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

export function useStaticAuth() {
  const user = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const logout = useCallback(() => {
    currentUser = null;
    emitChange();
  }, []);

  const deleteAccount = useCallback(() => {
    if (!currentUser) return;
    const idx = users.findIndex((u) => u.id === currentUser?.id);
    if (idx >= 0) users.splice(idx, 1);
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
    logout,
    deleteAccount,
    addAddress,
    setDefaultAddress,
    deleteAddress,
    getDefaultUserAddress,
  };
}
