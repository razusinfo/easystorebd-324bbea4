import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bold, Check, ChevronDown, ChevronUp, Copy, Eraser, ImageIcon, Italic, Link2,
  List, ListOrdered, Loader2, Plus, Quote, Trash2, Underline, Upload, Video, X,
} from "lucide-react";

import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { syncResellerProduct } from "@/lib/reseller-sync.functions";
import { upsertLocalResellerProduct } from "@/lib/reseller-local.functions";


import {
  useMyStore, useMyProducts, useUpsertProduct,
  useProductVariants, useProductDetails,
  useProductCategoryAssignments,
  uploadProductImage, deleteProductImage,
  useIsSuperAdmin,
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
  categoryIds: string[];
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
  defaultDeliveryCharge: string;
  specificDeliveryCharges: { id: string; zone: string; charge: string }[];

  variants: { id: string; name: string; value: string }[];
  details: { id: string; key: string; value: string }[];
  imageUrl: string;
  galleryUrls: string[];
  videoUrl: string;
  addToReseller: boolean;
  resellerPrice: string;
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
  categoryIds: [],
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
  defaultDeliveryCharge: "0",
  specificDeliveryCharges: [],

  variants: [],
  details: [],
  imageUrl: "",
  galleryUrls: [],
  videoUrl: "",
  addToReseller: false,
  resellerPrice: "",
};


export function ProductForm({ mode, productId, duplicateFromId, onDone, onCancel, onDuplicate }: Props) {
  const storeQ = useMyStore();
  const isSuperAdminQ = useIsSuperAdmin();
  const isSuperAdmin = !!isSuperAdminQ.data;
  const store = storeQ.data;
  const productsQ = useMyProducts(store?.id);
  const categoriesQ = useCategories(store?.id);
  const upsert = useUpsertProduct(store?.id);
  const queryClient = useQueryClient();


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
  const assignmentsQ = useProductCategoryAssignments(sourceId);

  // Hydrate once — either the product being edited, or the product being duplicated as a draft copy.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    const src = editing ?? sourceForDuplicate;
    if (!src) return;
    // Wait until variants/details/assignments finish loading so we hydrate everything together.
    if (variantsQ.isLoading || detailsQ.isLoading || assignmentsQ.isLoading) return;
    const assignedIds = assignmentsQ.data ?? [];
    const fallbackIds = src.category_id ? [src.category_id] : [];
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
      categoryIds: assignedIds.length ? assignedIds : fallbackIds,
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
      defaultDeliveryCharge: src.default_delivery_charge != null ? String(src.default_delivery_charge) : "0",
      specificDeliveryCharges: Array.isArray(src.specific_delivery_charges)
        ? src.specific_delivery_charges.map((s) => ({
            id: crypto.randomUUID(),
            zone: s.zone ?? "",
            charge: s.charge != null ? String(s.charge) : "",
          }))
        : [],

      variants: (variantsQ.data ?? []).map((v) => ({ id: v.id, name: v.name, value: v.value })),
      details: (detailsQ.data ?? []).map((d) => ({ id: d.id, key: d.key, value: d.value })),
      imageUrl: src.image_url ?? "",
      galleryUrls: Array.isArray(src.gallery_urls) ? src.gallery_urls : [],
      videoUrl: src.video_url ?? "",
      addToReseller: (src as { add_to_reseller?: boolean }).add_to_reseller ?? false,
      resellerPrice: (src as { reseller_price?: number | null }).reseller_price != null
        ? String((src as { reseller_price?: number | null }).reseller_price)
        : "",
    }));

    if (mode === "new" && sourceForDuplicate) {
      toast.success("Duplicated as a new draft — review and save");
    }
    setHydrated(true);
  }, [hydrated, editing, sourceForDuplicate, mode,
      variantsQ.data, variantsQ.isLoading,
      detailsQ.data, detailsQ.isLoading,
      assignmentsQ.data, assignmentsQ.isLoading]);



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
    if (uploading || galleryUploading) {
      toast.error("Please wait until image upload is complete");
      return;
    }
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
        galleryUrls: form.galleryUrls,
        shortDescription: form.shortDescription.trim() || null,
        description: form.description.trim() || null,
        categoryId: form.categoryIds[0] || null,
        categoryIds: form.categoryIds,

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
        defaultDeliveryCharge: form.defaultDeliveryCharge === "" ? null : Number(form.defaultDeliveryCharge),
        specificDeliveryCharges: form.specificDeliveryCharges
          .map((s) => ({ zone: s.zone.trim(), charge: Number(s.charge || "0") }))
          .filter((s) => s.zone && Number.isFinite(s.charge)),

        videoUrl: form.videoUrl.trim() || null,
        addToReseller: form.addToReseller,
        resellerPrice: form.addToReseller && form.resellerPrice !== ""
          ? Number(form.resellerPrice)
          : null,
        variants: form.variants.map((v) => ({ name: v.name, value: v.value })),
        details: form.details.map((d) => ({ key: d.key, value: d.value })),
      });
      toast.success(mode === "edit" ? "Product updated" : "Product added");
      // Only now that the DB is updated is it safe to remove the previously
      // referenced storage files.
      await flushPendingDeletes();
      // Invalidate storefront caches so the new product/image shows up right away.
      queryClient.invalidateQueries({ queryKey: ["public-store"] });
      queryClient.invalidateQueries({ queryKey: ["products", store?.id] });

      // Sync to reseller marketplace if enabled.
      if (form.addToReseller) {
        const productId = (upsert.data as { id: string } | undefined)?.id ?? editing?.id ?? "";
        // Resolve primary category name from the selected category ids.
        const primaryCatId = form.categoryIds[0];
        const categoryName =
          (categoriesQ.data ?? []).find((c) => c.id === primaryCatId)?.name ?? null;
        const resellerPriceNum =
          form.resellerPrice !== "" ? Number(form.resellerPrice) : null;

        // Local upsert into reseller_products so the in-app page reflects the change.
        try {
          await upsertLocalResellerProduct({
            data: {
              id: productId,
              name: form.name.trim(),
              description: form.description.trim() || null,
              image_url: form.imageUrl || null,
              price: Number(form.sellPrice),
              reseller_price: resellerPriceNum,
              category: categoryName,
            },
          });
          queryClient.invalidateQueries({ queryKey: ["reseller_products"] });
        } catch (err: any) {
          const status = err?.response?.status ?? err?.status;
          const msg = String(err?.message ?? "");
          if (status === 403 || /forbidden/i.test(msg)) {
            toast.error("Only super admins can add products to the reseller marketplace.");
          } else {
            toast.error(msg || "Reseller marketplace update failed");
          }
        }

        // Optional external SaaS sync (no-op if RESELLER_SYNC_URL isn't set).
        try {
          const res = await syncResellerProduct({
            data: {
              id: productId,
              name: form.name.trim(),
              description: form.description.trim() || null,
              image: form.imageUrl || null,
              price: Number(form.sellPrice),
              reseller_price: resellerPriceNum,
            },
          });
          if (!(res as { skipped?: boolean }).skipped) {
            toast.success("Synced to reseller marketplace");
          }
        } catch (err: any) {
          const status = err?.response?.status ?? err?.status;
          const msg = String(err?.message ?? "");
          if (status === 403 || /forbidden/i.test(msg)) {
            toast.error("Only super admins can sync to the external reseller marketplace.");
          } else {
            toast.error(msg || "External reseller sync failed");
          }
        }
      }
      onDone();

    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save product");
    }
  }


  // --- Image upload (unified: primary + gallery, first-picked is primary) ---
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  // URLs to delete from storage only AFTER the product is saved successfully.
  // Deleting earlier can leave the DB pointing at a missing storage object
  // if the user never clicks Save.
  const pendingDeletes = useRef<Set<string>>(new Set());
  const queueDelete = (url?: string | null) => {
    if (url && url.includes("/product-images/")) pendingDeletes.current.add(url);
  };
  const flushPendingDeletes = async () => {
    const urls = Array.from(pendingDeletes.current);
    pendingDeletes.current.clear();
    await Promise.all(urls.map((u) => deleteProductImage(u).catch(() => {})));
  };

  const MAX_IMAGES = 5; // primary + up to 4 more, in selection order
  const MAX_RAW_IMAGE_BYTES = 12 * 1024 * 1024; // phone photos are compressed before upload
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const MAX_GALLERY = MAX_IMAGES - 1;
  const totalImages = (form.imageUrl ? 1 : 0) + form.galleryUrls.length;
  const imageSlotsRemaining = Math.max(0, MAX_IMAGES - totalImages);

  /**
   * Upload one or more images. Preserves the order the user picked them in:
   * the very first picked image (when no primary exists yet) becomes the
   * primary product image; the rest fill the gallery in order.
   */
  async function handleAddImages(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;

    if (imageSlotsRemaining <= 0) {
      toast.error(`You can add up to ${MAX_IMAGES} images`);
      return;
    }

    const picked = list.slice(0, imageSlotsRemaining);
    if (list.length > imageSlotsRemaining) {
      toast.info(`Only ${imageSlotsRemaining} more image${imageSlotsRemaining > 1 ? "s" : ""} can be added`);
    }
    setUploading(true);
    setGalleryUploading(true);
    try {
      const uploadable = picked.filter((f) => {
        const isImg = f.type ? f.type.startsWith("image/") : /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name);
        if (!isImg) { toast.error(`Skipped ${f.name || "file"}: not an image`); return false; }
        if (f.size > MAX_RAW_IMAGE_BYTES) { toast.error(`Skipped ${f.name}: over 12MB`); return false; }
        return true;
      });
      if (!uploadable.length) return;

      setUploadProgress({ done: 0, total: uploadable.length });
      // Upload sequentially so selection order is preserved deterministically
      // and each successful upload shows immediately in the preview.
      const uploaded: string[] = [];
      for (let i = 0; i < uploadable.length; i++) {
        const f = uploadable[i];
        try {
          const { publicUrl } = await uploadProductImage(f);
          uploaded.push(publicUrl);
          // Live-append so the user sees each image appear as it finishes.
          setForm((prev) => {
            let primary = prev.imageUrl;
            const gallery = [...prev.galleryUrls];
            if ((primary ? 1 : 0) + gallery.length >= MAX_IMAGES) return prev;
            if (!primary) primary = publicUrl;
            else gallery.push(publicUrl);
            return { ...prev, imageUrl: primary, galleryUrls: gallery };
          });
        } catch (err: any) {
          toast.error(`${f.name || "Image"}: ${err?.message ?? "upload failed"}`);
        } finally {
          setUploadProgress({ done: i + 1, total: uploadable.length });
        }
      }
      if (!uploaded.length) return;
      markTouched("imageUrl");
      toast.success(`${uploaded.length} image${uploaded.length > 1 ? "s" : ""} added`);
    } finally {
      setUploading(false);
      setGalleryUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  // Back-compat aliases used by the existing UI.
  const handleImageFile = (f: File) => handleAddImages([f]);
  const handleGalleryFiles = (files: FileList | File[]) => handleAddImages(files);

  async function handleRemoveImage() {
    const url = form.imageUrl;
    // If gallery has images, promote the first gallery image to primary so
    // the product never ends up with only "extra" images and no main one.
    const [nextPrimary, ...rest] = form.galleryUrls;
    setForm((prev) => ({
      ...prev,
      imageUrl: nextPrimary ?? "",
      galleryUrls: rest,
    }));
    markTouched("imageUrl");
    queueDelete(url);
    toast.success("Image removed");
  }

  async function handleRemoveGalleryImage(url: string) {
    set("galleryUrls", form.galleryUrls.filter((u) => u !== url));
    queueDelete(url);
  }

  function handlePromoteGalleryImage(url: string) {
    // Swap: gallery image becomes the primary, previous primary joins gallery.
    const prev = form.imageUrl;
    const nextGallery = form.galleryUrls.filter((u) => u !== url);
    if (prev) nextGallery.unshift(prev);
    set("imageUrl", url);
    set("galleryUrls", nextGallery);
  }



  const loading = storeQ.isLoading || (mode === "edit" && productsQ.isLoading);

  // Category picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const flatCategories = useMemo(() => flattenCategories(catTree), [catTree]);
  const categoryLookup = useMemo(() => {
    const m = new Map<string, { name: string; depth: number }>();
    flatCategories.forEach((c) => m.set(c.id, { name: c.name, depth: c.depth }));
    return m;
  }, [flatCategories]);
  const toggleCategoryId = (id: string) =>
    set(
      "categoryIds",
      form.categoryIds.includes(id)
        ? form.categoryIds.filter((x) => x !== id)
        : [...form.categoryIds, id],
    );



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
            <Button onClick={handleSave} disabled={upsert.isPending || loading || uploading || galleryUploading}>
              {upsert.isPending || uploading || galleryUploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              Save
            </Button>
          </div>

        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 pb-6 pt-10 sm:px-6 sm:pt-12 lg:grid-cols-[1fr_360px]">
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
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length) handleAddImages(e.target.files);
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
                      <p className="truncate text-sm font-medium">
                        Primary image · {totalImages} of {MAX_IMAGES}
                      </p>
                      <p className="mt-0.5 text-xs text-foreground/60">
                        {form.imageUrl.includes("/product-images/")
                          ? "Saved to storage"
                          : "External URL"}
                        {uploadProgress ? ` · Uploading ${uploadProgress.done}/${uploadProgress.total}…` : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button" size="sm" variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading || imageSlotsRemaining <= 0}
                        >
                          {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                          Add more
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
                    if (e.dataTransfer.files?.length) handleAddImages(e.dataTransfer.files);
                  }}
                >
                  <ImageIcon className="h-8 w-8 text-foreground/40" />
                  <p className="mt-3 max-w-2xl text-xs text-foreground/60">
                    Drag and drop up to {MAX_IMAGES} images here, or click add. Supported: JPG, PNG, WEBP. Max 12MB each.
                    The first image you pick becomes the primary product image; the rest are shown in the order selected.
                  </p>
                  <Button
                    type="button" size="sm" variant="ghost"
                    className="mt-4 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                    Add Images
                  </Button>
                  {showError("imageUrl") && (
                    <p className="mt-2 text-xs font-medium text-destructive">{showError("imageUrl")}</p>
                  )}
                </div>
              )}


              {/* Gallery — additional images */}
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length) handleGalleryFiles(e.target.files);
                  }}
                />
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Additional images</p>
                    <p className="text-xs text-foreground/60">
                      Add up to {MAX_GALLERY} more photos. Click any to make it the primary image.
                    </p>
                  </div>
                  <Button
                    type="button" size="sm" variant="ghost"
                    className="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={galleryUploading || imageSlotsRemaining <= 0}
                  >
                    {galleryUploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                    Add images
                  </Button>
                </div>
                {form.galleryUrls.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-foreground/60">
                    No extra images yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {form.galleryUrls.map((url) => (
                      <div key={url} className="group relative aspect-square overflow-hidden rounded-md border border-border bg-background">
                        <img src={url} alt="Gallery" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handlePromoteGalleryImage(url)}
                          className="absolute inset-x-0 bottom-0 hidden bg-black/60 py-1 text-[10px] font-semibold text-white group-hover:block"
                          title="Set as primary image"
                        >
                          Make primary
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveGalleryImage(url)}
                          className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                          aria-label="Remove image"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>


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

            {isSuperAdmin && (
              <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <Checkbox
                    checked={form.addToReseller}
                    onCheckedChange={(v) => set("addToReseller", v === true)}
                  />
                  Add to Reseller Marketplace
                </label>
                {form.addToReseller && (
                  <Field label="Reseller Price">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="Reseller Price"
                      value={form.resellerPrice}
                      onChange={(e) => set("resellerPrice", e.target.value)}
                    />
                  </Field>
                )}
              </div>
            )}
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
            <div className="space-y-3">
              <h3 className="font-semibold text-primary">Delivery Charge</h3>
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
                    {form.useDefaultDelivery ? "Applied" : "Not Applied"}
                  </span>
                  <Switch
                    checked={form.useDefaultDelivery}
                    onCheckedChange={(v) => set("useDefaultDelivery", v)}
                  />
                </div>
              </div>

              {!form.useDefaultDelivery && (
                <div className="space-y-4 pt-1">
                  <Field
                    label="Delivery Charge (Default)"
                    hint="Default delivery charge will be applied to all areas, except for the specific zones listed below."
                  >
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0"
                      value={form.defaultDeliveryCharge}
                      onChange={(e) => set("defaultDeliveryCharge", e.target.value)}
                    />
                  </Field>

                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Specific Delivery Charges</h4>
                    {form.specificDeliveryCharges.length > 0 && (
                      <ul className="mb-3 space-y-2">
                        {form.specificDeliveryCharges.map((s, i) => (
                          <li key={s.id} className="grid grid-cols-[1fr_140px_auto] gap-2">
                            <Input
                              placeholder="Zone / area name (e.g. Dhaka)"
                              value={s.zone}
                              onChange={(e) => {
                                const next = [...form.specificDeliveryCharges];
                                next[i] = { ...s, zone: e.target.value };
                                set("specificDeliveryCharges", next);
                              }}
                            />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              placeholder="Charge"
                              value={s.charge}
                              onChange={(e) => {
                                const next = [...form.specificDeliveryCharges];
                                next[i] = { ...s, charge: e.target.value };
                                set("specificDeliveryCharges", next);
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                set(
                                  "specificDeliveryCharges",
                                  form.specificDeliveryCharges.filter((x) => x.id !== s.id),
                                )
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        set("specificDeliveryCharges", [
                          ...form.specificDeliveryCharges,
                          { id: crypto.randomUUID(), zone: "", charge: "" },
                        ])
                      }
                    >
                      + Add specific zone
                    </Button>
                  </div>
                </div>
              )}
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
            {form.categoryIds.length === 0 ? (
              <p className="mb-3 rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-foreground/60">
                No assigned category found
              </p>
            ) : (
              <div className="mb-3 flex flex-wrap gap-2">
                {form.categoryIds.map((id) => {
                  const meta = categoryLookup.get(id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary"
                    >
                      {meta?.name ?? "Unknown"}
                      <button
                        type="button"
                        onClick={() =>
                          set("categoryIds", form.categoryIds.filter((x) => x !== id))
                        }
                        className="grid h-4 w-4 place-items-center rounded-full text-primary/70 hover:bg-primary/10 hover:text-primary"
                        aria-label={`Remove ${meta?.name ?? "category"}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <Button
              type="button"
              className="w-full gradient-primary text-primary-foreground hover:opacity-90"
              onClick={() => setPickerOpen(true)}
            >
              Assign category
            </Button>
          </Section>

          <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-center gap-2 text-center">
                  Assign categories
                  <Link
                    to="/categories/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid h-7 w-7 place-items-center rounded-md gradient-primary text-primary-foreground hover:opacity-90"
                    title="Create new category"
                    aria-label="Create new category"
                  >
                    <Plus className="h-4 w-4" />
                  </Link>
                </DialogTitle>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto py-2">
                {flatCategories.length === 0 ? (
                  <p className="py-6 text-center text-sm text-foreground/60">
                    No categories yet. Click + to create one.
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-sm font-medium">Select categories</p>
                    <div className="flex flex-wrap gap-2">
                      {flatCategories.map((c) => {
                        const active = form.categoryIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleCategoryId(c.id)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-sm transition",
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background hover:border-primary/50 hover:text-primary",
                            )}
                          >
                            {"— ".repeat(c.depth)}{c.name}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  className="w-full gradient-primary text-primary-foreground hover:opacity-90"
                  onClick={() => setPickerOpen(false)}
                >
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>



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

      {/* Bottom action bar (mirrors sticky header) */}
      <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-5">
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
