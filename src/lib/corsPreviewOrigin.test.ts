import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The edge functions' CORS allow-list is Deno code that Vitest cannot import,
 * so this reads the regex out of the source and exercises it here. Without a
 * preview pattern, every browser-called function fails CORS on a Vercel
 * preview URL, which is how the landing page's intake chat came to look dead
 * on previews while working on localhost and on production.
 */
const CORS_SOURCE = readFileSync(
  resolve(process.cwd(), "supabase/functions/_shared/cors.ts"),
  "utf8"
);

const extractPattern = (name: string): RegExp => {
  const match = CORS_SOURCE.match(
    new RegExp(`const ${name} =\\s*(/(?:[^/\\\\]|\\\\.)+/);`)
  );
  if (!match) throw new Error(`${name} not found in cors.ts`);
  // eslint-disable-next-line no-eval
  return eval(match[1]) as RegExp;
};

const PREVIEW = extractPattern("PREVIEW_ORIGIN_PATTERN");
const DEV = extractPattern("DEV_ORIGIN_PATTERN");

describe("Vercel preview origins are allowed", () => {
  it.each([
    "https://atlas-career-chat-git-my-branch-falkor.vercel.app",
    "https://atlas-career-chat-a1b2c3d4-falkor.vercel.app",
    "https://atlas-career-chat-git-worktree-homepage-copy-cleanup-x.vercel.app",
  ])("accepts %s", (origin) => {
    expect(PREVIEW.test(origin)).toBe(true);
  });
});

describe("the preview pattern does not open the functions to the world", () => {
  it.each([
    // Another project on vercel.app — these functions call paid model APIs.
    "https://someone-elses-app.vercel.app",
    "https://evil.vercel.app",
    // Prefix must be the whole first label, not a substring anywhere.
    "https://evil-atlas-career-chat-x.vercel.app",
    // A lookalike domain that merely ends in vercel.app.
    "https://atlas-career-chat-x.vercel.app.attacker.com",
    // Bare http, and a subdomain sneaking past the anchor.
    "http://atlas-career-chat-x.vercel.app",
    "https://atlas-career-chat-x.vercel.app.evil.io",
  ])("rejects %s", (origin) => {
    expect(PREVIEW.test(origin)).toBe(false);
  });

  it("does not accept an origin carrying a path or port", () => {
    expect(PREVIEW.test("https://atlas-career-chat-x.vercel.app/admin")).toBe(false);
    expect(PREVIEW.test("https://atlas-career-chat-x.vercel.app:8080")).toBe(false);
  });
});

describe("localhost stays allowed and stays local", () => {
  it("accepts localhost with and without a port", () => {
    expect(DEV.test("http://localhost")).toBe(true);
    expect(DEV.test("http://localhost:8080")).toBe(true);
  });

  it("rejects a hostname that merely contains localhost", () => {
    expect(DEV.test("http://localhost.attacker.com")).toBe(false);
    expect(DEV.test("http://notlocalhost")).toBe(false);
  });
});

describe("production origins are listed explicitly", () => {
  it("still allows both apex and www", () => {
    expect(CORS_SOURCE).toContain("'https://cairnly.io'");
    expect(CORS_SOURCE).toContain("'https://www.cairnly.io'");
  });
});
