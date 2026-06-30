// Mock client-side store using localStorage. No backend wiring.
import { useEffect, useState } from "react";

export type Category = "Clothes" | "Electronics" | "Sports";
export type TemplateId = "minimal" | "boutique" | "techgrid" | "sporty" | "luxe";

export type Product = {
  id: string;
  storeId: string;
  name: string;
  price: number;
  stock: number;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
};

export type Store = {
  id: string;
  ownerName: string;
  ownerContact: string;
  loginMethod: "google" | "phone";
  name: string;
  category: Category;
  template: TemplateId;
  createdAt: number;
};

const STORES_KEY = "eazystore.stores";
const PRODUCTS_KEY = "eazystore.products";
const ACTIVE_KEY = "eazystore.activeStoreId";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("eazystore:change"));
}

export const db = {
  getStores: (): Store[] => read(STORES_KEY, []),
  getProducts: (): Product[] => read(PRODUCTS_KEY, []),
  getActiveStoreId: (): string | null => read(ACTIVE_KEY, null),
  setActiveStoreId: (id: string | null) => write(ACTIVE_KEY, id),
  addStore: (s: Store) => write(STORES_KEY, [...db.getStores(), s]),
  addProduct: (p: Product) => write(PRODUCTS_KEY, [...db.getProducts(), p]),
  updateProduct: (id: string, patch: Partial<Product>) =>
    write(
      PRODUCTS_KEY,
      db.getProducts().map((p) => (p.id === id ? { ...p, ...patch } : p)),
    ),
  deleteProduct: (id: string) =>
    write(
      PRODUCTS_KEY,
      db.getProducts().filter((p) => p.id !== id),
    ),
  seedIfEmpty() {
    if (db.getStores().length > 0) return;
    const sampleStores: Store[] = [
      {
        id: "s_demo1",
        ownerName: "Ayesha Rahman",
        ownerContact: "ayesha@example.com",
        loginMethod: "google",
        name: "Trendline Boutique",
        category: "Clothes",
        template: "boutique",
        createdAt: Date.now() - 86400000 * 3,
      },
      {
        id: "s_demo2",
        ownerName: "Karim Hossain",
        ownerContact: "+8801711000000",
        loginMethod: "phone",
        name: "Voltix Electronics",
        category: "Electronics",
        template: "techgrid",
        createdAt: Date.now() - 86400000,
      },
    ];
    const sampleProducts: Product[] = [
      { id: "p1", storeId: "s_demo1", name: "Linen Summer Dress", price: 1890, stock: 24, status: "pending", createdAt: Date.now() - 3600000 },
      { id: "p2", storeId: "s_demo2", name: "Wireless Earbuds Pro", price: 2499, stock: 60, status: "pending", createdAt: Date.now() - 7200000 },
      { id: "p3", storeId: "s_demo2", name: "65W GaN Charger", price: 1299, stock: 100, status: "approved", createdAt: Date.now() - 90000000 },
    ];
    write(STORES_KEY, sampleStores);
    write(PRODUCTS_KEY, sampleProducts);
  },
};

export function useStoreData() {
  const [, setTick] = useState(0);
  useEffect(() => {
    db.seedIfEmpty();
    const onChange = () => setTick((t) => t + 1);
    window.addEventListener("eazystore:change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("eazystore:change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return {
    stores: db.getStores(),
    products: db.getProducts(),
    activeStoreId: db.getActiveStoreId(),
  };
}

export const TEMPLATES: { id: TemplateId; name: string; tagline: string; gradient: string }[] = [
  { id: "minimal", name: "Minimal Mono", tagline: "Clean, editorial, type-led", gradient: "from-slate-900 to-slate-600" },
  { id: "boutique", name: "Boutique Blush", tagline: "Soft pastels for fashion", gradient: "from-pink-400 to-rose-500" },
  { id: "techgrid", name: "Tech Grid", tagline: "Dark, sharp, specs-first", gradient: "from-indigo-600 to-cyan-500" },
  { id: "sporty", name: "Sporty Pulse", tagline: "Bold, kinetic, energetic", gradient: "from-orange-500 to-red-600" },
  { id: "luxe", name: "Luxe Noir", tagline: "Premium dark with gold accents", gradient: "from-neutral-900 to-amber-600" },
];
