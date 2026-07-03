import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { User as SupaUser } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/account/")({
  component: ManageAccountPage,
});

function ManageAccountPage() {
  const [user, setUser] = useState<SupaUser | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      setUser(u ?? null);
      const md = (u?.user_metadata ?? {}) as Record<string, unknown>;
      setName((md.full_name as string) || (md.name as string) || "");
      setPhone((md.phone as string) || "");
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { name: name.trim(), full_name: name.trim(), phone: phone.trim() },
      });
      if (error) throw error;
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update profile");
    } finally { setSaving(false); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Manage My Account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Update your profile details. Your email is used to sign in.
      </p>

      <form onSubmit={handleSave} className="mt-6 grid max-w-lg gap-4">
        <div>
          <Label htmlFor="acc-email">Email</Label>
          <Input id="acc-email" value={user?.email ?? ""} disabled />
        </div>
        <div>
          <Label htmlFor="acc-name">Full Name</Label>
          <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="acc-phone">Mobile Number</Label>
          <Input id="acc-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
