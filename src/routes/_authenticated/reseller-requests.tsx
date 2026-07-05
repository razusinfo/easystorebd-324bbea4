import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, X, Send, ImageIcon, Check, AlertCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { uploadProductImage } from "@/lib/eazystore-data";
import { useIsSuperAdmin } from "@/lib/eazystore-data";
import { submitProductRequest, updateProductRequest, deleteProductRequest } from "@/lib/product-requests.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/reseller-requests")({
  component: ResellerRequestsPage,
});

const MAX_IMAGES = 8;

function ResellerRequestsPage() {
  const isAdmin = useIsSuperAdmin();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Reseller Requests</h1>
        <p className="text-sm text-muted-foreground">
          Submit a new product you'd like added to the marketplace. Super admins review and approve requests.
        </p>
      </div>

      <HighlightedRequestCard />

      <SubmitRequestForm />

      <Separator />
      <MyRequestsList />

      {isAdmin.data ? (
        <>
          <Separator />
          <PendingRequestsList />
        </>
      ) : null}
    </div>
  );
}

function HighlightedRequestCard() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search).get("request");
    setId(p);
  }, []);
  const q = useQuery({
    queryKey: ["reseller-request-single", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_requests")
        .select("id, name, price, status, admin_notes, reviewed_at, images")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (!id || !q.data) return null;
  const r = q.data;
  const tone =
    r.status === "approved"
      ? "border-green-500/40 bg-green-500/5"
      : r.status === "rejected"
        ? "border-destructive/40 bg-destructive/5"
        : "border-primary/40 bg-primary/5";
  const Icon = r.status === "approved" ? Check : r.status === "rejected" ? X : AlertCircle;
  return (
    <Card className={`ring-2 ring-primary/40 ${tone}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5" /> Your request: {r.name}
          <Badge variant="secondary" className="capitalize">{r.status}</Badge>
        </CardTitle>
        <CardDescription>
          Submitted price ৳{Number(r.price).toLocaleString()}
          {r.reviewed_at ? ` · Reviewed ${new Date(r.reviewed_at).toLocaleString()}` : ""}
        </CardDescription>
      </CardHeader>
      {r.admin_notes ? (
        <CardContent>
          <p className="text-sm"><span className="font-semibold">Admin notes:</span> {r.admin_notes}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

function SubmitRequestForm() {
  const qc = useQueryClient();
  const submit = useServerFn(submitProductRequest);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const priceNum = Number(price);
      if (!name.trim()) throw new Error("Product name is required");
      if (!Number.isFinite(priceNum) || priceNum < 0) throw new Error("Enter a valid price");
      return submit({
        data: {
          name: name.trim(),
          description: description || null,
          price: priceNum,
          category: category || null,
          images,
        },
      });
    },
    onSuccess: () => {
      toast.success("Request submitted. Super admins have been notified.");
      setName(""); setPrice(""); setCategory(""); setDescription(""); setImages([]);
      qc.invalidateQueries({ queryKey: ["pending-product-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) {
      toast.error(`Max ${MAX_IMAGES} files`);
      return;
    }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const f of toUpload) {
        const { publicUrl } = await uploadProductImage(f);
        uploaded.push(publicUrl);
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (e) {
      toast.error((e as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Product Request</CardTitle>
        <CardDescription>Anyone can submit. Once approved, it appears in Reseller Products.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rr-name">Product Name *</Label>
            <Input id="rr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wireless Earbuds" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rr-price">Price *</Label>
            <Input id="rr-price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="rr-cat">Category</Label>
            <Input id="rr-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Electronics" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="rr-desc">Description</Label>
            <Textarea id="rr-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details, specs, sourcing notes…" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Images / Videos (up to {MAX_IMAGES})</Label>
          <div className="flex flex-wrap gap-3">
            {images.map((url) => (
              <div key={url} className="relative h-24 w-24 overflow-hidden rounded-md border bg-muted">
                {/\.(mp4|webm|mov)(\?|$)/i.test(url) ? (
                  <video src={url} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={url} alt="upload" className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => setImages((p) => p.filter((u) => u !== url))}
                  className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5 text-foreground shadow"
                  aria-label="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES ? (
              <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted/40">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                <span>{uploading ? "Uploading" : "Add"}</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { void handleFiles(e.target.files); e.currentTarget.value = ""; }}
                  disabled={uploading}
                />
              </label>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || uploading}>
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Submit Request
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PendingRequestsList() {
  const q = useQuery({
    queryKey: ["pending-product-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_requests")
        .select("id, name, description, price, category, images, status, requested_by, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Pending Requests
          <Badge variant="secondary">{q.data?.length ?? 0}</Badge>
        </CardTitle>
        <CardDescription>Visible to super admins only. Approve or reject in the Admin panel.</CardDescription>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (q.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          <ul className="divide-y">
            {q.data!.map((r) => {
              const first = (r.images as string[] | null)?.[0];
              return (
                <li key={r.id} className="flex items-start gap-3 py-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {first ? (
                      <img src={first} alt={r.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate font-medium">{r.name}</div>
                      <div className="shrink-0 text-sm font-semibold">৳ {Number(r.price).toLocaleString()}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.category ? <span className="mr-2">{r.category}</span> : null}
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                    {r.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

type MyReq = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  images: string[] | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

function MyRequestsList() {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateProductRequest);
  const deleteFn = useServerFn(deleteProductRequest);
  const [editing, setEditing] = useState<MyReq | null>(null);

  const q = useQuery({
    queryKey: ["my-product-requests"],
    queryFn: async (): Promise<MyReq[]> => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("product_requests")
        .select("id, name, description, price, category, images, status, admin_notes, created_at")
        .eq("requested_by", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MyReq[];
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Request deleted");
      qc.invalidateQueries({ queryKey: ["my-product-requests"] });
      qc.invalidateQueries({ queryKey: ["pending-product-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-product-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Hide approved requests — once approved, the product lives in Reseller Products.
  const rows = (q.data ?? []).filter((r: any) => r.status !== "approved");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          My Requests
          <Badge variant="secondary">{rows.length}</Badge>
        </CardTitle>
        <CardDescription>Pending requests can be edited or deleted until a super admin reviews them.</CardDescription>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't submitted any requests yet.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => {
              const first = r.images?.[0];
              const pending = r.status === "pending";
              return (
                <li key={r.id} className="flex items-start gap-3 py-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {first ? (
                      <img src={first} alt={r.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{r.name}</span>
                          <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{r.status}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ৳ {Number(r.price).toLocaleString()}
                          {r.category ? <> · {r.category}</> : null}
                          {" · "}{new Date(r.created_at).toLocaleString()}
                        </div>
                        {r.admin_notes ? (
                          <p className="mt-1 text-xs"><span className="font-semibold">Admin:</span> {r.admin_notes}</p>
                        ) : null}
                      </div>
                      {pending && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(`Delete request "${r.name}"?`)) del.mutate(r.id);
                            }}
                            disabled={del.isPending}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {editing ? (
          <EditRequestDialog
            request={editing}
            onClose={() => setEditing(null)}
            onSave={async (values) => {
              try {
                await updateFn({ data: { id: editing.id, ...values } });
                toast.success("Request updated");
                setEditing(null);
                qc.invalidateQueries({ queryKey: ["my-product-requests"] });
                qc.invalidateQueries({ queryKey: ["pending-product-requests"] });
                qc.invalidateQueries({ queryKey: ["admin-product-requests"] });
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function EditRequestDialog({
  request,
  onClose,
  onSave,
}: {
  request: MyReq;
  onClose: () => void;
  onSave: (values: {
    name: string;
    description: string | null;
    price: number;
    category: string | null;
    images: string[];
  }) => Promise<void>;
}) {
  const [name, setName] = useState(request.name);
  const [price, setPrice] = useState(String(request.price));
  const [category, setCategory] = useState(request.category ?? "");
  const [description, setDescription] = useState(request.description ?? "");
  const [images] = useState<string[]>(request.images ?? []);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const p = Number(price);
    if (!name.trim()) return toast.error("Name is required");
    if (!Number.isFinite(p) || p < 0) return toast.error("Enter a valid price");
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        price: p,
        category: category.trim() || null,
        images,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-background p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-lg font-semibold">Edit request</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="e-name">Product Name *</Label>
            <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="e-price">Price *</Label>
              <Input id="e-price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-cat">Category</Label>
              <Input id="e-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-desc">Description</Label>
            <Textarea id="e-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
