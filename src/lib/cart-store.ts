import { create } from "zustand";

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  qty: number;
};

type CartMap = Record<string, CartItem[]>;

type CartState = {
  carts: CartMap;
  add: (storeId: string, item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (storeId: string, productId: string, qty: number) => void;
  remove: (storeId: string, productId: string) => void;
  clear: (storeId: string) => void;
};

const STORAGE_KEY = "eazystore-cart-v1";

function loadInitial(): CartMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as CartMap) : {};
  } catch { return {}; }
}

function saveCarts(carts: CartMap) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(carts)); } catch { /* ignore */ }
}

export const useCartStore = create<CartState>((set) => ({
  carts: loadInitial(),
  add: (storeId, item, qty = 1) =>
    set((state) => {
      const cart = state.carts[storeId] ?? [];
      const idx = cart.findIndex((i) => i.productId === item.productId);
      const next =
        idx >= 0
          ? cart.map((it, i) => (i === idx ? { ...it, qty: it.qty + qty } : it))
          : [...cart, { ...item, qty }];
      const carts = { ...state.carts, [storeId]: next };
      saveCarts(carts);
      return { carts };
    }),
  setQty: (storeId, productId, qty) =>
    set((state) => {
      const cart = state.carts[storeId] ?? [];
      const nextCart = qty <= 0
        ? cart.filter((i) => i.productId !== productId)
        : cart.map((i) => (i.productId === productId ? { ...i, qty } : i));
      const carts = { ...state.carts, [storeId]: nextCart };
      saveCarts(carts);
      return { carts };
    }),
  remove: (storeId, productId) =>
    set((state) => {
      const cart = state.carts[storeId] ?? [];
      const carts = {
        ...state.carts,
        [storeId]: cart.filter((i) => i.productId !== productId),
      };
      saveCarts(carts);
      return { carts };
    }),
  clear: (storeId) =>
    set((state) => {
      const carts = { ...state.carts, [storeId]: [] };
      saveCarts(carts);
      return { carts };
    }),
}));

const EMPTY: CartItem[] = [];
export function useStoreCart(storeId: string | undefined): CartItem[] {
  return useCartStore((s) => (storeId && s.carts[storeId]) || EMPTY);
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}
