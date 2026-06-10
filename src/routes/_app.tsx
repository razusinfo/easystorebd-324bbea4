import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getSession } from "@/lib/session";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!getSession()) navigate({ to: "/" });
  }, [navigate]);

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
