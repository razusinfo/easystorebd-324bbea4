import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "bn" | "en";

const dict = {
  // brand
  brand: { bn: "বঙ্গ ইনভেন্টরি", en: "Bongo Inventory" },
  tagline: {
    bn: "বাংলাদেশের জন্য সর্বাধুনিক ইনভেন্টরি ও পয়েন্ট অব সেল সফটওয়্যার",
    en: "Bangladesh's most advanced Inventory & POS software",
  },

  // auth
  login: { bn: "লগইন", en: "Login" },
  signup: { bn: "সাইন আপ", en: "Sign Up" },
  email: { bn: "ইমেইল", en: "Email" },
  password: { bn: "পাসওয়ার্ড", en: "Password" },
  signIn: { bn: "সাইন ইন করুন", en: "Sign In" },
  demoLogin: { bn: "ডেমো হিসেবে প্রবেশ করুন", en: "Continue as Demo" },
  welcomeBack: { bn: "আবার স্বাগতম", en: "Welcome back" },
  signInToContinue: {
    bn: "আপনার ব্যবসা পরিচালনা করতে সাইন ইন করুন",
    en: "Sign in to manage your business",
  },

  // nav
  dashboard: { bn: "ড্যাশবোর্ড", en: "Dashboard" },
  pos: { bn: "পয়েন্ট অব সেল", en: "Point of Sale" },
  inventory: { bn: "ইনভেন্টরি", en: "Inventory" },
  products: { bn: "পণ্য", en: "Products" },
  sales: { bn: "বিক্রয়", en: "Sales" },
  purchases: { bn: "ক্রয়", en: "Purchases" },
  customers: { bn: "গ্রাহক", en: "Customers" },
  suppliers: { bn: "সরবরাহকারী", en: "Suppliers" },
  reports: { bn: "প্রতিবেদন", en: "Reports" },
  installments: { bn: "কিস্তি", en: "Installments" },
  warranty: { bn: "ওয়ারেন্টি ও সার্ভিস", en: "Warranty & Service" },
  imei: { bn: "IMEI ট্র্যাকিং", en: "IMEI Tracking" },
  accounting: { bn: "হিসাব", en: "Accounting" },
  employees: { bn: "কর্মী", en: "Employees" },
  superAdmin: { bn: "সুপার অ্যাডমিন", en: "Super Admin" },
  settings: { bn: "সেটিংস", en: "Settings" },
  logout: { bn: "লগ আউট", en: "Logout" },

  // dashboard
  greeting: { bn: "শুভ দিন", en: "Good day" },
  todaySales: { bn: "আজকের বিক্রয়", en: "Today's Sales" },
  monthlyProfit: { bn: "মাসিক মুনাফা", en: "Monthly Profit" },
  totalStock: { bn: "মোট স্টক", en: "Total Stock" },
  customerDue: { bn: "গ্রাহক বাকি", en: "Customer Due" },
  supplierDue: { bn: "সরবরাহকারী বাকি", en: "Supplier Due" },
  lowStock: { bn: "লো স্টক সতর্কতা", en: "Low Stock Alerts" },
  topProducts: { bn: "সর্বাধিক বিক্রিত পণ্য", en: "Top Selling Products" },
  recentSales: { bn: "সাম্প্রতিক বিক্রয়", en: "Recent Sales" },
  salesOverview: { bn: "বিক্রয় সারসংক্ষেপ", en: "Sales Overview" },
  weekly: { bn: "সাপ্তাহিক", en: "Weekly" },

  // common
  search: { bn: "অনুসন্ধান করুন...", en: "Search..." },
  new: { bn: "নতুন", en: "New" },
  add: { bn: "যোগ করুন", en: "Add" },
  edit: { bn: "এডিট", en: "Edit" },
  delete: { bn: "ডিলিট", en: "Delete" },
  save: { bn: "সংরক্ষণ", en: "Save" },
  cancel: { bn: "বাতিল", en: "Cancel" },
  total: { bn: "মোট", en: "Total" },
  qty: { bn: "পরিমাণ", en: "Qty" },
  price: { bn: "মূল্য", en: "Price" },
  discount: { bn: "ছাড়", en: "Discount" },
  vat: { bn: "ভ্যাট", en: "VAT" },
  payable: { bn: "প্রদেয়", en: "Payable" },
  paid: { bn: "পরিশোধিত", en: "Paid" },
  due: { bn: "বাকি", en: "Due" },
  payment: { bn: "পেমেন্ট", en: "Payment" },
  checkout: { bn: "চেকআউট", en: "Checkout" },
  cart: { bn: "কার্ট", en: "Cart" },
  emptyCart: { bn: "কার্ট খালি — পণ্য যোগ করুন", en: "Cart is empty — add products" },
  customerLabel: { bn: "গ্রাহক", en: "Customer" },
  walkIn: { bn: "ওয়াক-ইন গ্রাহক", en: "Walk-in customer" },
  invoice: { bn: "ইনভয়েস", en: "Invoice" },
  print: { bn: "প্রিন্ট", en: "Print" },
  status: { bn: "অবস্থা", en: "Status" },
  date: { bn: "তারিখ", en: "Date" },
  name: { bn: "নাম", en: "Name" },
  phone: { bn: "ফোন", en: "Phone" },
  category: { bn: "ক্যাটাগরি", en: "Category" },
  brandLabel: { bn: "ব্র্যান্ড", en: "Brand" },
  stock: { bn: "স্টক", en: "Stock" },
  sku: { bn: "এসকেইউ", en: "SKU" },
  warehouse: { bn: "ওয়্যারহাউস", en: "Warehouse" },

  // misc
  comingSoon: { bn: "শীঘ্রই আসছে", en: "Coming Soon" },
  moduleDesc: {
    bn: "এই মডিউলটি পরবর্তী আপডেটে যুক্ত হবে।",
    en: "This module will be available in the next update.",
  },
  madeBy: { bn: "এই সফটওয়্যার প্রস্তুতকারক:", en: "Software developed by:" },
  makerName: { bn: "নুসরাত টেলিকম", en: "Nusrat Telecom" },
  hotline: { bn: "হটলাইন", en: "Hotline" },

  // inventory
  outOfStock: { bn: "স্টক শেষ", en: "Out of Stock" },
  lowStockBadge: { bn: "লো স্টক", en: "Low Stock" },
  criticalLowStock: { bn: "সংকটজনক লো স্টক", en: "Critical Low Stock" },
  outOfStockCta: { bn: "স্টক শেষ", en: "Out of Stock" },
  outOfStockFromSupplier: {
    bn: "সরবরাহকারীর কাছে স্টক শেষ",
    en: "Out of stock from supplier",
  },
  addToMyShop: { bn: "আমার শপে যোগ করুন", en: "Add to My Shop" },
};

type Key = keyof typeof dict;

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("bn");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("bongo.lang")) as Lang | null;
    if (saved === "bn" || saved === "en") setLangState(saved);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dataset.lang = lang;
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("bongo.lang", l);
  };

  const t = (k: Key) => dict[k]?.[lang] ?? String(k);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be inside I18nProvider");
  return ctx;
}

/** Format number with Bangla digits when lang === bn */
export function formatNumber(value: number, lang: Lang, opts?: Intl.NumberFormatOptions) {
  const locale = lang === "bn" ? "bn-BD" : "en-US";
  return new Intl.NumberFormat(locale, opts).format(value);
}

export function formatCurrency(value: number, lang: Lang) {
  return (lang === "bn" ? "৳ " : "৳") + formatNumber(value, lang, { maximumFractionDigits: 0 });
}
