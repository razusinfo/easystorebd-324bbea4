// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { LOGO_CACHE_PREFIX, primeSplashCache } from "./splash-cache";

const KEY = (raw: string) => LOGO_CACHE_PREFIX + raw;

afterEach(() => {
  window.localStorage.clear();
});

describe("primeSplashCache", () => {
  it("writes the slug key immediately for cache invalidation", () => {
    const { writes } = primeSplashCache({
      slug: "sylhetionlineshop",
      customDomain: null,
      logoUrl: "https://cdn/example/logo.png",
      splashUrl: null,
      onSubdomain: true,
      onCustomDomain: true,
    });
    expect(writes["sylhetionlineshop"]).toBe("https://cdn/example/logo.png");
    expect(window.localStorage.getItem(KEY("sylhetionlineshop"))).toBe(
      "https://cdn/example/logo.png",
    );
  });

  it("uses splash logo on subdomain host when opted in", () => {
    primeSplashCache({
      slug: "acme",
      customDomain: null,
      logoUrl: "https://cdn/logo.png",
      splashUrl: "https://cdn/splash.png",
      onSubdomain: true,
      onCustomDomain: false,
    });
    expect(window.localStorage.getItem(KEY("acme.easystorebd.com"))).toBe(
      "https://cdn/splash.png",
    );
  });

  it("falls back to storefront logo on subdomain when splash disabled", () => {
    primeSplashCache({
      slug: "acme",
      customDomain: null,
      logoUrl: "https://cdn/logo.png",
      splashUrl: "https://cdn/splash.png",
      onSubdomain: false,
      onCustomDomain: false,
    });
    expect(window.localStorage.getItem(KEY("acme.easystorebd.com"))).toBe(
      "https://cdn/logo.png",
    );
  });

  it("writes the custom-domain key only when the store has one", () => {
    primeSplashCache({
      slug: "acme",
      customDomain: "Shop.Example.COM",
      logoUrl: "https://cdn/logo.png",
      splashUrl: "https://cdn/splash.png",
      onSubdomain: true,
      onCustomDomain: true,
    });
    // Custom domain is normalized to lowercase.
    expect(window.localStorage.getItem(KEY("shop.example.com"))).toBe(
      "https://cdn/splash.png",
    );
  });

  it("skips custom-domain key entirely when store has no domain configured", () => {
    const { writes } = primeSplashCache({
      slug: "acme",
      customDomain: null,
      logoUrl: "https://cdn/logo.png",
      splashUrl: "https://cdn/splash.png",
      onSubdomain: true,
      onCustomDomain: true,
    });
    // Only slug + subdomain entries, no custom domain.
    expect(Object.keys(writes)).toEqual([
      "acme",
      "acme.easystorebd.com",
    ]);
  });

  it("overwrites an existing cache entry on save (invalidation)", () => {
    window.localStorage.setItem(KEY("acme"), "https://cdn/old.png");
    primeSplashCache({
      slug: "acme",
      customDomain: null,
      logoUrl: "https://cdn/new.png",
      splashUrl: null,
      onSubdomain: true,
      onCustomDomain: true,
    });
    expect(window.localStorage.getItem(KEY("acme"))).toBe("https://cdn/new.png");
  });

  it("removes cached entries when the logo path is cleared", () => {
    window.localStorage.setItem(KEY("acme"), "https://cdn/old.png");
    window.localStorage.setItem(
      KEY("acme.easystorebd.com"),
      "https://cdn/old-splash.png",
    );
    const { removes } = primeSplashCache({
      slug: "acme",
      customDomain: null,
      logoUrl: null,
      splashUrl: null,
      onSubdomain: true,
      onCustomDomain: true,
    });
    expect(removes).toContain("acme");
    expect(removes).toContain("acme.easystorebd.com");
    expect(window.localStorage.getItem(KEY("acme"))).toBeNull();
    expect(
      window.localStorage.getItem(KEY("acme.easystorebd.com")),
    ).toBeNull();
  });

  it("swallows storage errors and still reports intent (SSR/private-mode safe)", () => {
    const throwing = {
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    const { writes } = primeSplashCache({
      slug: "acme",
      customDomain: null,
      logoUrl: "https://cdn/logo.png",
      splashUrl: null,
      onSubdomain: true,
      onCustomDomain: true,
      storage: throwing,
    });
    // Storage refused, but the helper still records what it *tried* to write.
    expect(writes["acme"]).toBe("https://cdn/logo.png");
  });

  it("uses apexHost override for testable subdomain keys", () => {
    primeSplashCache({
      slug: "acme",
      customDomain: null,
      logoUrl: "https://cdn/logo.png",
      splashUrl: "https://cdn/splash.png",
      onSubdomain: true,
      onCustomDomain: false,
      apexHost: "shop.test",
    });
    expect(window.localStorage.getItem(KEY("acme.shop.test"))).toBe(
      "https://cdn/splash.png",
    );
  });
});
