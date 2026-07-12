import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Static regression: the sidebar source must render the notifications group
// (which contains "Order Notifications") strictly AFTER the reseller-zone
// group (which contains "Order For Suppliers"). This ordering is single-source
// in app-sidebar.tsx, so it applies identically for every role and viewport.
describe("AppSidebar item order", () => {
  const src = readFileSync(
    resolve(__dirname, "app-sidebar.tsx"),
    "utf8",
  );

  it("declares 'Order For Suppliers' before 'Order Notifications' in item arrays", () => {
    const suppliers = src.indexOf('"Order For Suppliers"');
    const notifications = src.indexOf('"Order Notifications"');
    expect(suppliers).toBeGreaterThan(-1);
    expect(notifications).toBeGreaterThan(-1);
    expect(suppliers).toBeLessThan(notifications);
  });

  it("renders the notifications SidebarGroup after the reseller-zone group", () => {
    const zone = src.indexOf('data-testid="reseller-zone-group"');
    const notifRender = src.indexOf("notificationItems");
    // notificationItems is referenced twice: array declaration then JSX render.
    const notifRenderJsx = src.indexOf("notificationItems", notifRender + 1);
    expect(zone).toBeGreaterThan(-1);
    expect(notifRenderJsx).toBeGreaterThan(-1);
    expect(notifRenderJsx).toBeGreaterThan(zone);
  });
});
