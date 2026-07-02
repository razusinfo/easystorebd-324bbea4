import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  qty: number;
};

// Cart is scoped per-store so each storefront has its own basket.
type CartMap = Record<string, CartItem[]>;

type CartState = {
  carts: CartMap;
  add: (storeId: string, item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (storeId: string, productId: string, qty: number) => void;
  remove: (storeId: string, productId: string) => void;
  clear: (storeId: string) => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      carts: {},
      add: (storeId, item, qty = 1) =>
        set((state) => {
          const cart = state.carts[storeId] ?? [];
          const idx = cart.findIndex((i) => i.productId === item.productId);
          const next =
            idx >= 0
              ? cart.map((it, i) => (i === idx ? { ...it, qty: it.qty + qty } : it))
              : [...cart, { ...item, qty }];
          return { carts: { ...state.carts, [storeId]: next } };
        }),
      setQty: (storeId, productId, qty) =>
        set((state) => {
          const cart = state.carts[storeId] ?? [];
          const next = qty <= 0
            ? cart.filter((i) => i.productId !== productId)
            : cart.map((i) => (i.productId === productId ? { ...i, qty } : i));
          return { carts: { ...state.carts, [storeId]: next } };
        }),
      remove: (storeId, productId) =>
        set((state) => {
          const cart = state.carts[storeId] ?? [];
          return {
            carts: {
              ...state.carts,
              [storeId]: cart.filter((i) => i.productId !== productId),
            },
          };
        }),
      clear: (storeId) =>
        set((state) => ({ carts: { ...state.carts, [storeId]: [] } })),
    }),
    {
      name: "eazystore-cart-v1",
      // SSR-safe: only reach localStorage in the browser.
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? ({ getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown as Storage)
          : window.localStorage
      ),
      skipHydration: false,
    }

  )
);

const EMPTY: CartItem[] = [];
export function useStoreCart(storeId: string | undefined) {
  return useCartStore((s) => (storeId ? s.carts[storeId] ?? EMPTY : EMPTY));
}


export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}
