import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const ok = !!session;
      setAuthed(ok);
      setChecked(true);
      if (!ok) navigate({ to: "/" });
    });

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const ok = !!data.session;
      setAuthed(ok);
      setChecked(true);
      if (!ok) navigate({ to: "/" });
    });

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [navigate]);

  if (!checked || !authed) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
