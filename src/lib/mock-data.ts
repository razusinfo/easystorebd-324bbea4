export type Product = {
  id: string;
  name: string;
  nameBn: string;
  sku: string;
  category: string;
  brand: string;
  price: number;
  cost: number;
  stock: number;
  lowStockAt: number;
  warehouse: string;
};

export const products: Product[] = [
  { id: "P-1001", name: "Samsung Galaxy A55", nameBn: "স্যামসাং গ্যালাক্সি A55", sku: "MOB-SAM-A55", category: "Mobile", brand: "Samsung", price: 48500, cost: 42000, stock: 24, lowStockAt: 5, warehouse: "Dhaka Main" },
  { id: "P-1002", name: "iPhone 15 Pro 256GB", nameBn: "আইফোন ১৫ প্রো ২৫৬জিবি", sku: "MOB-APL-15P", category: "Mobile", brand: "Apple", price: 168000, cost: 152000, stock: 6, lowStockAt: 3, warehouse: "Dhaka Main" },
  { id: "P-1003", name: "Xiaomi Redmi Note 13", nameBn: "শাওমি রেডমি নোট ১৩", sku: "MOB-XMI-N13", category: "Mobile", brand: "Xiaomi", price: 23900, cost: 20500, stock: 41, lowStockAt: 8, warehouse: "Chittagong" },
  { id: "P-1004", name: "Hikvision CCTV 4MP Dome", nameBn: "হিকভিশন সিসিটিভি ৪MP", sku: "CCT-HIK-4MD", category: "CCTV", brand: "Hikvision", price: 4200, cost: 3100, stock: 88, lowStockAt: 20, warehouse: "Dhaka Main" },
  { id: "P-1005", name: "Walton Refrigerator 240L", nameBn: "ওয়ালটন রেফ্রিজারেটর ২৪০L", sku: "HOM-WAL-R240", category: "Electronics", brand: "Walton", price: 38900, cost: 33000, stock: 12, lowStockAt: 4, warehouse: "Dhaka Main" },
  { id: "P-1006", name: "Pran Mango Juice 1L", nameBn: "প্রাণ ম্যাঙ্গো জুস ১L", sku: "GRO-PRN-MJ1", category: "Grocery", brand: "Pran", price: 180, cost: 140, stock: 312, lowStockAt: 50, warehouse: "Dhaka Main" },
  { id: "P-1007", name: "Square Napa Extra 500mg", nameBn: "স্কয়ার নাপা এক্সট্রা ৫০০mg", sku: "PHR-SQR-NPX", category: "Pharmacy", brand: "Square", price: 2.5, cost: 1.8, stock: 1820, lowStockAt: 200, warehouse: "Sylhet" },
  { id: "P-1008", name: "Cotton Panjabi (M)", nameBn: "কটন পাঞ্জাবি (M)", sku: "FSH-COT-PJM", category: "Fashion", brand: "Aarong", price: 2400, cost: 1500, stock: 3, lowStockAt: 10, warehouse: "Dhaka Main" },
  { id: "P-1009", name: "Stanley Hammer 16oz", nameBn: "স্ট্যানলি হ্যামার ১৬oz", sku: "HRD-STN-H16", category: "Hardware", brand: "Stanley", price: 950, cost: 700, stock: 47, lowStockAt: 10, warehouse: "Chittagong" },
  { id: "P-1010", name: "Realme Buds Air 5", nameBn: "রিয়েলমি বাডস এয়ার ৫", sku: "ACC-RLM-BA5", category: "Gadget", brand: "Realme", price: 4500, cost: 3400, stock: 28, lowStockAt: 8, warehouse: "Dhaka Main" },
];

export type Customer = {
  id: string;
  name: string;
  phone: string;
  due: number;
  totalPurchase: number;
};
export const customers: Customer[] = [
  { id: "C-001", name: "Rahim Uddin", phone: "01711-234567", due: 0, totalPurchase: 124500 },
  { id: "C-002", name: "Fatema Begum", phone: "01812-345678", due: 4200, totalPurchase: 38900 },
  { id: "C-003", name: "Karim Sheikh", phone: "01913-456789", due: 12500, totalPurchase: 268000 },
  { id: "C-004", name: "Nasrin Akter", phone: "01612-567890", due: 0, totalPurchase: 9400 },
  { id: "C-005", name: "Jamal Hossain", phone: "01511-678901", due: 1800, totalPurchase: 56000 },
];

export type Supplier = {
  id: string;
  name: string;
  contact: string;
  due: number;
};
export const suppliers: Supplier[] = [
  { id: "S-01", name: "Samsung BD Distributor", contact: "02-9876543", due: 245000 },
  { id: "S-02", name: "Pran-RFL Group", contact: "02-8801234", due: 32000 },
  { id: "S-03", name: "Hikvision Bangladesh", contact: "01700-111222", due: 78000 },
  { id: "S-04", name: "Square Pharma", contact: "02-7733445", due: 0 },
];

export type Sale = {
  id: string;
  invoice: string;
  customer: string;
  date: string;
  total: number;
  paid: number;
  status: "Paid" | "Partial" | "Due";
};
export const sales: Sale[] = [
  { id: "1", invoice: "INV-24115", customer: "Rahim Uddin", date: "2026-06-10", total: 48500, paid: 48500, status: "Paid" },
  { id: "2", invoice: "INV-24114", customer: "Karim Sheikh", date: "2026-06-10", total: 23900, paid: 12000, status: "Partial" },
  { id: "3", invoice: "INV-24113", customer: "Walk-in", date: "2026-06-10", total: 4200, paid: 4200, status: "Paid" },
  { id: "4", invoice: "INV-24112", customer: "Fatema Begum", date: "2026-06-09", total: 38900, paid: 0, status: "Due" },
  { id: "5", invoice: "INV-24111", customer: "Nasrin Akter", date: "2026-06-09", total: 9400, paid: 9400, status: "Paid" },
  { id: "6", invoice: "INV-24110", customer: "Jamal Hossain", date: "2026-06-08", total: 56000, paid: 50000, status: "Partial" },
];

export const salesChart = [
  { day: "শনি", en: "Sat", sales: 42000, profit: 12000 },
  { day: "রবি", en: "Sun", sales: 58000, profit: 18500 },
  { day: "সোম", en: "Mon", sales: 71000, profit: 22000 },
  { day: "মঙ্গল", en: "Tue", sales: 49000, profit: 15000 },
  { day: "বুধ", en: "Wed", sales: 86000, profit: 28000 },
  { day: "বৃহঃ", en: "Thu", sales: 102000, profit: 34000 },
  { day: "শুক্র", en: "Fri", sales: 124000, profit: 42000 },
];

export const topProducts = [
  { name: "Galaxy A55", value: 124, color: "var(--color-primary)" },
  { name: "Redmi Note 13", value: 98, color: "var(--color-accent)" },
  { name: "Hikvision 4MP", value: 76, color: "var(--color-info)" },
  { name: "Realme Buds 5", value: 64, color: "var(--color-success)" },
  { name: "Walton Fridge", value: 32, color: "var(--color-warning)" },
];

export type Role =
  | "super_admin"
  | "store_owner"
  | "manager"
  | "cashier"
  | "salesman"
  | "accountant"
  | "technician"
  | "warehouse_manager";

export const roleLabels: Record<Role, { bn: string; en: string }> = {
  super_admin: { bn: "সুপার অ্যাডমিন", en: "Super Admin" },
  store_owner: { bn: "স্টোর মালিক", en: "Store Owner" },
  manager: { bn: "ম্যানেজার", en: "Manager" },
  cashier: { bn: "ক্যাশিয়ার", en: "Cashier" },
  salesman: { bn: "সেলসম্যান", en: "Salesman" },
  accountant: { bn: "অ্যাকাউন্ট্যান্ট", en: "Accountant" },
  technician: { bn: "টেকনিশিয়ান", en: "Technician" },
  warehouse_manager: { bn: "ওয়্যারহাউস ম্যানেজার", en: "Warehouse Manager" },
};
