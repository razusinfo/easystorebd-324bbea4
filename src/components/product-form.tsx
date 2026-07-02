import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bold, Check, ChevronDown, ChevronUp, Copy, Eraser, ImageIcon, Italic, Link2,
  List, ListOrdered, Loader2, Quote, Trash2, Underline, Upload, Video, X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import {
  useMyStore, useMyProducts, useUpsertProduct,
  useProductVariants, useProductDetails,
  uploadProductImage, deleteProductImage,
  type ProductRow,
} from "@/lib/eazystore-data";
import { useCategories, buildCategoryTree, type CategoryNode } from "@/lib/categories-data";


type Props = {
  mode: "new" | "edit";
  productId?: string;
  /** When set (and mode="new"), pre-fills the form from this product as a draft copy. */
  duplicateFromId?: string;
  onDone: () => void;
  onCancel: () => void;
  /** Optional handler for the top-bar Duplicate button (edit mode only). */
  onDuplicate?: () => void;
};


type FormState = {
  name: string;
  shortDescription: string;
  description: string;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  status: "active" | "inactive";
  brand: string;
  condition: "new" | "used" | "refurbished";
  categoryId: string;
  sellPrice: string;
  regularPrice: string;
  buyingPrice: string;
  productSerial: string;
  sku: string;
  unitName: string;
  stock: string;
  warranty: string;
  initialSoldCount: string;
  useDefaultDelivery: boolean;
  variants: { id: string; name: string; value: string }[];
  details: { id: string; key: string; value: string }[];
  imageUrl: string;
  videoUrl: string;
};

const initialState: FormState = {
  name: "",
  shortDescription: "",
  description: "",
  weightKg: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
  status: "active",
  brand: "",
  condition: "new",
  categoryId: "",
  sellPrice: "",
  regularPrice: "",
  buyingPrice: "",
  productSerial: "0",
  sku: "",
  unitName: "",
  stock: "",
  warranty: "",
  initialSoldCount: "0",
  useDefaultDelivery: true,
  variants: [],
  details: [],
  imageUrl: "",
  videoUrl: "",
};

export function ProductForm({ mode, productId, duplicateFromId, onDone, onCancel, onDuplicate }: Props) {
  const storeQ = useMyStore();
  const store = storeQ.data;
  const productsQ = useMyProducts(store?.id);
  const categoriesQ = useCategories(store?.id);
  const upsert = useUpsertProduct(store?.id);

  const [form, setForm] = useState<FormState>(initialState);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const editing = useMemo<ProductRow | undefined>(
    () => (mode === "edit" && productId ? productsQ.data?.find((p) => p.id === productId) : undefined),
    [mode, productId, productsQ.data],
  );

  const sourceForDuplicate = useMemo<ProductRow | undefined>(
    () => (mode === "new" && duplicateFromId ? productsQ.data?.find((p) => p.id === duplicateFromId) : undefined),
    [mode, duplicateFromId, productsQ.data],
  );

  // Load variants/details for the source product (edit target or duplicate source)
  const sourceId = editing?.id ?? sourceForDuplicate?.id;
  const variantsQ = useProductVariants(sourceId);
  const detailsQ = useProductDetails(sourceId);

  // Hydrate once — either the product being edited, or the product being duplicated as a draft copy.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    const src = editing ?? sourceForDuplicate;
    if (!src) return;
    // Wait until variants/details finish loading so we hydrate everything together.
    if (variantsQ.isLoading || detailsQ.isLoading) return;
    setForm((prev) => ({
      ...prev,
      name: mode === "new" ? `${src.name} (Copy)` : src.name,
      shortDescription: src.short_description ?? "",
      description: src.description ?? "",
      weightKg: src.weight_kg != null ? String(src.weight_kg) : "",
      lengthCm: src.length_cm != null ? String(src.length_cm) : "",
      widthCm: src.width_cm != null ? String(src.width_cm) : "",
      heightCm: src.height_cm != null ? String(src.height_cm) : "",
      status: prev.status,
      brand: src.brand ?? "",
      condition: (src.condition as FormState["condition"]) ?? "new",
      categoryId: src.category_id ?? "",
      sellPrice: String(src.price),
      regularPrice: src.regular_price != null ? String(src.regular_price) : "",
      buyingPrice: src.buying_price != null ? String(src.buying_price) : "",
      productSerial: src.product_serial ?? "0",
      sku: src.sku ?? "",
      unitName: src.unit_name ?? "",
      stock: String(src.stock),
      warranty: src.warranty ?? "",
      initialSoldCount: src.initial_sold_count != null ? String(src.initial_sold_count) : "0",
      useDefaultDelivery: src.use_default_delivery ?? true,
      variants: (variantsQ.data ?? []).map((v) => ({ id: v.id, name: v.name, value: v.value })),
      details: (detailsQ.data ?? []).map((d) => ({ id: d.id, key: d.key, value: d.value })),
      imageUrl: src.image_url ?? "",
      videoUrl: src.video_url ?? "",
    }));
    if (mode === "new" && sourceForDuplicate) {
      toast.success("Duplicated as a new draft — review and save");
    }
    setHydrated(true);
  }, [hydrated, editing, sourceForDuplicate, mode, variantsQ.data, variantsQ.isLoading, detailsQ.data, detailsQ.isLoading]);


  const catTree = useMemo<CategoryNode[]>(
    () => buildCategoryTree(categoriesQ.data ?? []),
    [categoriesQ.data],
  );

  // --- Inline validation ---
  type Errors = Partial<Record<"name" | "sellPrice" | "regularPrice" | "buyingPrice" | "stock" | "imageUrl", string>>;
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validate = (f: FormState): Errors => {
    const e: Errors = {};
    if (!f.name.trim()) e.name = "Item Name is required";
    else if (f.name.trim().length > 200) e.name = "Item Name must be 200 characters or less";

    const sp = Number(f.sellPrice);
    if (f.sellPrice === "" || !Number.isFinite(sp)) e.sellPrice = "Sell/Current Price is required";
    else if (sp < 0) e.sellPrice = "Price cannot be negative";

    if (f.regularPrice !== "") {
      const rp = Number(f.regularPrice);
      if (!Number.isFinite(rp) || rp < 0) e.regularPrice = "Enter a valid regular price";
    }
    if (f.buyingPrice !== "") {
      const bp = Number(f.buyingPrice);
      if (!Number.isFinite(bp) || bp < 0) e.buyingPrice = "Enter a valid buying price";
    }

    const st = Number(f.stock || "0");
    if (!Number.isInteger(st) || st < 0) e.stock = "Enter a valid stock quantity";

    if (f.imageUrl && !/^https?:\/\//i.test(f.imageUrl)) {
      e.imageUrl = "Image URL must start with http(s)://";
    }
    return e;
  };

  useEffect(() => { setErrors(validate(form)); }, [form]);
  const markTouched = (name: string) => setTouched((p) => ({ ...p, [name]: true }));
  const showError = (name: keyof Errors) => touched[name] ? errors[name] : undefined;

  async function handleSave() {
    if (!store) return toast.error("No store found");
    setTouched({ name: true, sellPrice: true, regularPrice: true, buyingPrice: true, stock: true, imageUrl: true });
    const eNow = validate(form);
    setErrors(eNow);
    if (Object.keys(eNow).length) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    const numOrNull = (s: string) => (s === "" ? null : Number(s));
    try {
      await upsert.mutateAsync({
        id: editing?.id,
        name: form.name.trim(),
        price: Number(form.sellPrice),
        stock: Number(form.stock || "0"),
        imageUrl: form.imageUrl || null,
        shortDescription: form.shortDescription.trim() || null,
        description: form.description.trim() || null,
        categoryId: form.categoryId || null,
        brand: form.brand.trim() || null,
        condition: form.condition,
        weightKg: numOrNull(form.weightKg),
        lengthCm: numOrNull(form.lengthCm),
        widthCm: numOrNull(form.widthCm),
        heightCm: numOrNull(form.heightCm),
        regularPrice: numOrNull(form.regularPrice),
        buyingPrice: numOrNull(form.buyingPrice),
        sku: form.sku.trim() || null,
        unitName: form.unitName.trim() || null,
        productSerial: form.productSerial.trim() || null,
        warranty: form.warranty.trim() || null,
        initialSoldCount: Number(form.initialSoldCount || "0"),
        useDefaultDelivery: form.useDefaultDelivery,
        videoUrl: form.videoUrl.trim() || null,
        variants: form.variants.map((v) => ({ name: v.name, value: v.value })),
        details: form.details.map((d) => ({ key: d.key, value: d.value })),
      });
      toast.success(mode === "edit" ? "Product updated" : "Product added");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save product");
    }
  }

  // --- Image upload ---
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be 4MB or smaller");
      return;
    }
    setUploading(true);
    try {
      const { publicUrl } = await uploadProductImage(file);
      // If replacing an existing uploaded image (same bucket), remove the old file.
      if (form.imageUrl && form.imageUrl.includes("/product-images/")) {
        await deleteProductImage(form.imageUrl).catch(() => {});
      }
      set("imageUrl", publicUrl);
      markTouched("imageUrl");
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveImage() {
    const url = form.imageUrl;
    set("imageUrl", "");
    markTouched("imageUrl");
    if (url && url.includes("/product-images/")) {
      try { await deleteProductImage(url); } catch { /* ignore */ }
    }
    toast.success("Image removed");
  }

  const loading = storeQ.isLoading || (mode === "edit" && productsQ.isLoading);


  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <header className="sticky top-12 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <h1 className="font-display text-xl font-black sm:text-2xl">
            {mode === "edit" ? "Edit Product" : "Add Product"}
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={upsert.isPending}
              className="bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive"
            >
              <X className="mr-1 h-4 w-4" /> Discard
            </Button>
            {mode === "edit" && onDuplicate && (
              <Button variant="outline" onClick={onDuplicate} disabled={upsert.isPending || loading}>
                <Copy className="mr-1 h-4 w-4" /> Duplicate
              </Button>
            )}
            <Button onClick={handleSave} disabled={upsert.isPending || loading}>
              {upsert.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              Save
            </Button>
          </div>

        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_360px]">
        {/* LEFT column */}
        <div className="space-y-5">
          <Section title="General Information">
            <div className="space-y-4">
              <Field label="Item Name" required error={showError("name")}>
                <Input
                  placeholder="Item Name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  onBlur={() => markTouched("name")}
                  aria-invalid={!!showError("name")}
                />
              </Field>

              <Field
                label="Short Description (SEO & Data Feed)"
                hint={`${form.shortDescription.length}/255`}
              >
                <Textarea
                  maxLength={255}
                  placeholder="Short Description"
                  value={form.shortDescription}
                  onChange={(e) => set("shortDescription", e.target.value)}
                  className="min-h-[80px]"
                />
              </Field>
              <Field label="Product Description">
                <div className="rounded-md border border-input bg-background">
                  <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-2 py-1.5 text-foreground/70">
                    <select className="mr-1 h-7 rounded-sm border border-input bg-background px-2 text-xs">
                      <option>Normal</option>
                      <option>Heading 1</option>
                      <option>Heading 2</option>
                      <option>Heading 3</option>
                    </select>
                    <ToolbarBtn><Bold className="h-3.5 w-3.5" /></ToolbarBtn>
                    <ToolbarBtn><Italic className="h-3.5 w-3.5" /></ToolbarBtn>
                    <ToolbarBtn><Underline className="h-3.5 w-3.5" /></ToolbarBtn>
                    <ToolbarBtn><Quote className="h-3.5 w-3.5" /></ToolbarBtn>
                    <span className="mx-1 h-4 w-px bg-border" />
                    <ToolbarBtn><span className="text-xs font-bold underline">A</span></ToolbarBtn>
                    <ToolbarBtn><ListOrdered className="h-3.5 w-3.5" /></ToolbarBtn>
                    <ToolbarBtn><List className="h-3.5 w-3.5" /></ToolbarBtn>
                    <span className="mx-1 h-4 w-px bg-border" />
                    <ToolbarBtn><Link2 className="h-3.5 w-3.5" /></ToolbarBtn>
                    <ToolbarBtn><ImageIcon className="h-3.5 w-3.5" /></ToolbarBtn>
                    <ToolbarBtn><Eraser className="h-3.5 w-3.5" /></ToolbarBtn>
                  </div>
                  <Textarea
                    placeholder="Write something..."
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    className="min-h-[140px] rounded-none border-0 focus-visible:ring-0"
                  />
                </div>
              </Field>
            </div>
          </Section>

          <Section title="Media">
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageFile(f);
                }}
              />

              {form.imageUrl ? (
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-start gap-4">
                    {/* Preview */}
                    <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-md border border-border bg-background">
                      <img
                        src={form.imageUrl}
                        alt="Product preview"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{form.imageUrl}</p>
                      <p className="mt-0.5 text-xs text-foreground/60">
                        {form.imageUrl.includes("/product-images/")
                          ? "Uploaded to storage"
                          : "External URL"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button" size="sm" variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                          Replace
                        </Button>
                        <Button
                          type="button" size="sm" variant="outline"
                          onClick={handleRemoveImage}
                          disabled={uploading}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="mr-1 h-4 w-4" /> Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "grid place-items-center rounded-lg border-2 border-dashed p-10 text-center transition-colors",
                    showError("imageUrl") ? "border-destructive/60 bg-destructive/5" : "border-border bg-transparent",
                  )}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleImageFile(f);
                  }}
                >
                  <ImageIcon className="h-8 w-8 text-foreground/40" />
                  <p className="mt-3 max-w-2xl text-xs text-foreground/60">
                    Drag and drop image here, or click add image. Supported formats: JPG, PNG, Max size: 4MB.
                    Note: For the Sellora theme, use images with a 1:1.6 aspect ratio — for example, 570×924 pixels or 855×1386 pixels.
                  </p>
                  <Button
                    type="button" size="sm" variant="ghost"
                    className="mt-4 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                    Add Image
                  </Button>
                  {showError("imageUrl") && (
                    <p className="mt-2 text-xs font-medium text-destructive">{showError("imageUrl")}</p>
                  )}
                </div>
              )}

              {form.videoUrl ? (
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Video className="h-5 w-5 shrink-0 text-foreground/50" />
                    <p className="truncate text-sm">{form.videoUrl}</p>
                  </div>
                  <Button size="sm" variant="ghost"
                    onClick={() => set("videoUrl", "")}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="grid place-items-center rounded-lg border-2 border-dashed border-border p-10 text-center">
                  <Video className="h-8 w-8 text-foreground/40" />
                  <p className="mt-3 text-xs text-foreground/60">Paste the video link here</p>
                  <Button
                    type="button" size="sm" variant="ghost"
                    className="mt-4 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                    onClick={() => {
                      const url = window.prompt("Paste video URL (YouTube, Vimeo, etc.)");
                      if (url) set("videoUrl", url.trim());
                    }}
                  >
                    <Link2 className="mr-1 h-4 w-4" /> Add Link
                  </Button>
                </div>
              )}
            </div>
          </Section>


          <Section title="Pricing">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Sell/Current Price" required error={showError("sellPrice")}>
                <Input type="number" min="0" step="0.01" inputMode="decimal"
                  placeholder="Sell/Current Price"
                  value={form.sellPrice}
                  onChange={(e) => set("sellPrice", e.target.value)}
                  onBlur={() => markTouched("sellPrice")}
                  aria-invalid={!!showError("sellPrice")}
                />
              </Field>
              <Field label="Regular/Old Price" error={showError("regularPrice")}>
                <Input type="number" min="0" step="0.01" inputMode="decimal"
                  placeholder="Regular/Old Price"
                  value={form.regularPrice}
                  onChange={(e) => set("regularPrice", e.target.value)}
                  onBlur={() => markTouched("regularPrice")}
                  aria-invalid={!!showError("regularPrice")}
                />
              </Field>
              <Field label="Buying Price (Optional)" error={showError("buyingPrice")}>
                <Input type="number" min="0" step="0.01" inputMode="decimal"
                  placeholder="Buying Price (Optional)"
                  value={form.buyingPrice}
                  onChange={(e) => set("buyingPrice", e.target.value)}
                  onBlur={() => markTouched("buyingPrice")}
                  aria-invalid={!!showError("buyingPrice")}
                />
              </Field>

            </div>
          </Section>

          <Section title="Inventory">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Product Serial">
                <Input value={form.productSerial}
                  onChange={(e) => set("productSerial", e.target.value)} />
              </Field>
              <Field label="SKU / Product Code">
                <Input placeholder="SKU / Product Code"
                  value={form.sku} onChange={(e) => set("sku", e.target.value)} />
              </Field>
              <Field label="Unit Name">
                <Input placeholder="e.g. kg, ml, l, mg"
                  value={form.unitName} onChange={(e) => set("unitName", e.target.value)} />
              </Field>
              <Field label="Quantity (Stock)" required error={showError("stock")}>
                <Input type="number" min="0" step="1" inputMode="numeric"
                  placeholder="Quantity (Stock)"
                  value={form.stock}
                  onChange={(e) => set("stock", e.target.value)}
                  onBlur={() => markTouched("stock")}
                  aria-invalid={!!showError("stock")}
                />
              </Field>

              <Field label="Warranty">
                <Input placeholder="Warranty"
                  value={form.warranty} onChange={(e) => set("warranty", e.target.value)} />
              </Field>
              <Field label="Initial Sold Count">
                <Input type="number" min="0" step="1" inputMode="numeric"
                  value={form.initialSoldCount}
                  onChange={(e) => set("initialSoldCount", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Shipping">
            <div className="space-y-2">
              <h3 className="font-semibold">Delivery Charge</h3>
              <p className="text-sm text-foreground/60">
                You can add specific delivery charge for this product or use the default charges
              </p>
              <div className="mt-2 flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <span className="text-sm font-medium">Apply default delivery charges</span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs font-bold",
                    form.useDefaultDelivery ? "text-primary" : "text-foreground/50",
                  )}>
                    {form.useDefaultDelivery ? "Applied" : "Off"}
                  </span>
                  <Switch
                    checked={form.useDefaultDelivery}
                    onCheckedChange={(v) => set("useDefaultDelivery", v)}
                  />
                </div>
              </div>
            </div>
          </Section>

          <Section title="Product Variants">
            <p className="text-sm text-foreground/60">
              You can add multiple variants for a single product here. Like Size, Color, Weight etc.
            </p>
            {form.variants.length > 0 && (
              <ul className="mt-3 space-y-2">
                {form.variants.map((v, i) => (
                  <li key={v.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input placeholder="Name (e.g. Size)" value={v.name}
                      onChange={(e) => {
                        const next = [...form.variants];
                        next[i] = { ...v, name: e.target.value };
                        set("variants", next);
                      }} />
                    <Input placeholder="Value (e.g. XL)" value={v.value}
                      onChange={(e) => {
                        const next = [...form.variants];
                        next[i] = { ...v, value: e.target.value };
                        set("variants", next);
                      }} />
                    <Button variant="ghost" size="icon"
                      onClick={() => set("variants", form.variants.filter((x) => x.id !== v.id))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" size="sm" className="mt-3"
              onClick={() => set("variants", [
                ...form.variants,
                { id: crypto.randomUUID(), name: "", value: "" },
              ])}>
              + Add a new variant
            </Button>
          </Section>

          <Section title="Product Details">
            <p className="text-sm text-foreground/60">
              You can add multiple product details here. Like Brand, Model, Serial Number, Fabric Type, EMI etc.
            </p>
            {form.details.length > 0 && (
              <ul className="mt-3 space-y-2">
                {form.details.map((d, i) => (
                  <li key={d.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input placeholder="Label" value={d.key}
                      onChange={(e) => {
                        const next = [...form.details];
                        next[i] = { ...d, key: e.target.value };
                        set("details", next);
                      }} />
                    <Input placeholder="Value" value={d.value}
                      onChange={(e) => {
                        const next = [...form.details];
                        next[i] = { ...d, value: e.target.value };
                        set("details", next);
                      }} />
                    <Button variant="ghost" size="icon"
                      onClick={() => set("details", form.details.filter((x) => x.id !== d.id))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" size="sm" className="mt-3"
              onClick={() => set("details", [
                ...form.details,
                { id: crypto.randomUUID(), key: "", value: "" },
              ])}>
              + Add a new field
            </Button>
          </Section>
        </div>

        {/* RIGHT column */}
        <aside className="space-y-5">
          <Section title="Category">
            {catTree.length === 0 ? (
              <div className="space-y-3 text-center">
                <p className="text-sm text-foreground/60">No assigned category found</p>
                <Button className="w-full" variant="default"
                  onClick={() => toast.info("Create categories from the Categories page.")}>
                  Assign category
                </Button>
              </div>
            ) : (
              <Select value={form.categoryId} onValueChange={(v) => set("categoryId", v)}>
                <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                <SelectContent>
                  {flattenCategories(catTree).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {"— ".repeat(c.depth)}{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Section>

          <Section title="Product Weight & Dimensions">
            <div className="space-y-4">
              <Field label="Weight (kg)" hint="Enter weight in kilograms">
                <Input type="number" min="0" step="0.01" inputMode="decimal"
                  placeholder="e.g. 1.5"
                  value={form.weightKg} onChange={(e) => set("weightKg", e.target.value)} />
              </Field>
              <div>
                <Label className="text-sm">Dimensions (cm)</Label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Input placeholder="L" value={form.lengthCm}
                    onChange={(e) => set("lengthCm", e.target.value)} />
                  <Input placeholder="W" value={form.widthCm}
                    onChange={(e) => set("widthCm", e.target.value)} />
                  <Input placeholder="H" value={form.heightCm}
                    onChange={(e) => set("heightCm", e.target.value)} />
                </div>
                <p className="mt-1 text-xs text-foreground/50">Enter dimensions in centimeters (L × W × H)</p>
              </div>
            </div>
          </Section>

          <Section title="Product Status" collapsible={false}>
            <Select value={form.status} onValueChange={(v) => set("status", v as FormState["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">ACTIVE</SelectItem>
                <SelectItem value="inactive">INACTIVE</SelectItem>
              </SelectContent>
            </Select>
          </Section>

          <Section title="Brand (SEO & Data Feed)">
            <Input placeholder="Brand Name" value={form.brand}
              onChange={(e) => set("brand", e.target.value)} />
          </Section>

          <Section title="Condition (SEO & Data Feed)">
            <Select value={form.condition} onValueChange={(v) => set("condition", v as FormState["condition"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="used">Used</SelectItem>
                <SelectItem value="refurbished">Refurbished</SelectItem>
              </SelectContent>
            </Select>
          </Section>
        </aside>
      </div>
    </div>
  );
}

function Section({
  title, children, collapsible = true,
}: { title: string; children: React.ReactNode; collapsible?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between px-5 py-3">
        <h2 className="font-display text-base font-black">{title}</h2>
        {collapsible && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md p-1 text-foreground/50 hover:bg-foreground/5 hover:text-foreground"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </header>
      {open && <div className="border-t border-border px-5 py-4">{children}</div>}
    </section>
  );
}

function Field({
  label, required, hint, error, children,
}: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label className="text-sm">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        {hint && <span className="text-xs text-foreground/50">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

function ToolbarBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex h-7 w-7 items-center justify-center rounded-sm hover:bg-foreground/5"
      tabIndex={-1}
    >
      {children}
    </button>
  );
}


function flattenCategories(nodes: CategoryNode[], depth = 0): { id: string; name: string; depth: number }[] {
  const out: { id: string; name: string; depth: number }[] = [];
  for (const n of nodes) {
    out.push({ id: n.id, name: n.name, depth });
    if (n.children.length) out.push(...flattenCategories(n.children, depth + 1));
  }
  return out;
}
