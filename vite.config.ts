import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // `supabase/functions` is Deno at runtime, but pure-logic modules there
    // (no Deno.* imports) are plain TypeScript and worth unit testing. Only
    // *.test.ts files are collected, so nothing Deno-specific is loaded...
    // EXCEPT a handful of pre-existing tests under supabase/functions were
    // themselves written for Deno's own test runner (they call the global
    // `Deno.test(...)` and import assertions from a remote
    // `https://deno.land/...` URL). Node/vitest has no `Deno` global and
    // can't resolve a bare https:// specifier, so vitest would fail to even
    // import them. They already run via `deno test` elsewhere; that's their
    // test runner, not vitest's. Excluded by name below so the suite stays
    // green. A NEW vitest-style test under supabase/functions (like
    // searchCredits.test.ts) needs no entry here — only Deno-style tests do.
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/*.test.ts'],
    exclude: [
      ...configDefaults.exclude,
      'supabase/functions/_shared/outreach.test.ts',
      'supabase/functions/_shared/outreachMail.test.ts',
      'supabase/functions/_shared/outreachFollowUp.test.ts',
      'supabase/functions/resume-strengthen/request.test.ts',
      'supabase/functions/resume-strengthen/strength.test.ts',
      'supabase/functions/forward-to-n8n/n8n-delivery.test.ts',
    ],
  },
}));
