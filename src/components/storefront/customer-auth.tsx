import { useEffect, useState } from "react";
import { User, LogOut, Loader2, UserCog, Package, Heart, Star, RotateCcw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { User as SupaUser } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useServerFn } from "@tanstack/react-start";
import { signInWithPhone } from "@/lib/phone-login.functions";

type Props = {
  /** Optional; when set, the button is styled to match the storefront accent. */
  accentClass?: string;
};

export function CustomerAuth({ accentClass = "acc-bg" }: Props) {
  const [user, setUser] = useState<SupaUser | null>(null);
  const [open, setOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [loginMode, setLoginMode] = useState<"email" | "phone">("email");
  const [loginId, setLoginId] = useState("");
  const resolveEmailForPhone = useServerFn(emailForPhone);

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset link sent — check your email.");
      setForgotOpen(false);
      setForgotEmail("");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send reset email");
    } finally { setForgotBusy(false); }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let signInEmail = loginId.trim();
      if (loginMode === "phone") {
        const { email: found } = await resolveEmailForPhone({ data: { phone: signInEmail } });
        signInEmail = found;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password,
      });
      if (error) throw error;
      toast.success("Signed in");
      setOpen(false);
      setLoginId(""); setPassword("");
    } catch (err: any) {
      toast.error(err?.message ?? "Login failed");
    } finally { setBusy(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Full name and mobile number are required");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            name: name.trim(),
            full_name: name.trim(),
            phone: phone.trim(),
          },
        },
      });
      if (error) throw error;
      toast.success("Account created — you're signed in.");
      setOpen(false);
      setEmail(""); setPassword(""); setName(""); setPhone("");
    } catch (err: any) {
      toast.error(err?.message ?? "Registration failed");
    } finally { setBusy(false); }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Signed out");
  }

  if (user) {
    const label = (user.user_metadata?.name as string | undefined) || user.email || "Account";
    const initial = label.charAt(0).toUpperCase();
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`${accentClass} grid h-11 w-11 place-items-center rounded-full text-white shadow-md sm:h-14 sm:w-14`}
            aria-label="Account"
          >
            <span className="font-display text-base font-black sm:text-lg">{initial}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="truncate">{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/account" className="flex items-center">
              <UserCog className="mr-2 h-4 w-4" /> Manage My Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/orders" className="flex items-center">
              <Package className="mr-2 h-4 w-4" /> My Orders
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/wishlist" className="flex items-center">
              <Heart className="mr-2 h-4 w-4" /> My Wishlist &amp; Followed Stores
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/reviews" className="flex items-center">
              <Star className="mr-2 h-4 w-4" /> My Reviews
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/returns" className="flex items-center">
              <RotateCcw className="mr-2 h-4 w-4" /> My Returns &amp; Cancellations
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${accentClass} grid h-11 w-11 place-items-center rounded-full text-white shadow-md sm:h-14 sm:w-14`}
        aria-label="Login or register"
      >
        <User className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Welcome</DialogTitle>
            <DialogDescription>
              Sign in for faster checkout. You can also order as a guest.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-3 pt-2">
                <Tabs value={loginMode} onValueChange={(v) => { setLoginMode(v as "email" | "phone"); setLoginId(""); }}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="email">Email</TabsTrigger>
                    <TabsTrigger value="phone">Mobile Number</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div>
                  <Label htmlFor="li-id">
                    {loginMode === "email" ? "Email" : "Mobile Number"}
                  </Label>
                  <Input
                    id="li-id"
                    type={loginMode === "email" ? "email" : "tel"}
                    inputMode={loginMode === "email" ? "email" : "tel"}
                    autoComplete={loginMode === "email" ? "email" : "tel"}
                    required
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="li-pass">Password</Label>
                  <Input id="li-pass" type="password" required
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : "Sign in"}
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-xs font-medium text-muted-foreground underline hover:text-foreground"
                  onClick={() => { setForgotEmail(loginMode === "email" ? loginId : ""); setForgotOpen(true); }}
                >
                  Forgot password?
                </button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-3 pt-2">
                <div>
                  <Label htmlFor="re-name">Full Name *</Label>
                  <Input id="re-name" required
                    value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="re-email">Email *</Label>
                  <Input id="re-email" type="email" required
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="re-phone">Mobile Number *</Label>
                  <Input id="re-phone" type="tel" required inputMode="tel"
                    value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="re-pass">Password *</Label>
                  <Input id="re-pass" type="password" required minLength={6}
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-center text-xs text-muted-foreground">
            Prefer not to sign in? Just add items to your cart and checkout as a guest.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              Enter your account email. We'll send you a link to set a new password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgot} className="space-y-3 pt-2">
            <div>
              <Label htmlFor="fp-email">Email</Label>
              <Input id="fp-email" type="email" required
                value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={forgotBusy}>
              {forgotBusy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</> : "Send reset link"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
