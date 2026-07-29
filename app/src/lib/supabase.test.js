import { describe, it, expect, beforeEach, vi } from "vitest";

/* Guards against a regression that would make guest mode (no Supabase
   configured) throw at build or runtime — non-negotiable #4. */
describe("supabase client guard", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is unconfigured when env vars are absent", async () => {
    const { isSupabaseConfigured, supabase } = await import("./supabase.js");
    expect(isSupabaseConfigured()).toBe(false);
    expect(supabase()).toBeNull();
  });

  it("is configured when both env vars are present", async () => {
    vi.stubEnv("PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    const { isSupabaseConfigured, supabase } = await import("./supabase.js");
    expect(isSupabaseConfigured()).toBe(true);
    expect(supabase()).not.toBeNull();
  });
});
