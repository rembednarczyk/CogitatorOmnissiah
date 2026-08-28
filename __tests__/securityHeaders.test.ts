/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { securityHeaders } from "../middleware/securityHeaders";

const makeApp = () => {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders());
  app.get("/", (_req, res) => res.send("ok"));
  app.get("/boom", (_req, res) => res.status(500).json({ error: "x" }));
  return app;
};

describe("securityHeaders", () => {
  it("sets the frame/sniff/referrer headers", async () => {
    const res = await request(makeApp()).get("/");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["referrer-policy"]).toBe("same-origin");
  });

  it("does not advertise Express", async () => {
    const res = await request(makeApp()).get("/");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("sets a CSP that pins the directives this app actually relies on", async () => {
    const csp = (await request(makeApp()).get("/")).headers["content-security-policy"];
    expect(csp).toContain("frame-ancestors 'none'");   // clickjacking
    expect(csp).toContain("form-action 'self'");       // second line under the CSRF guard
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self'");
  });

  it("allows exactly the external resources the app loads", async () => {
    const csp = (await request(makeApp()).get("/")).headers["content-security-policy"];
    expect(csp).toContain("https://fonts.googleapis.com"); // @import in index.css
    expect(csp).toContain("https://fonts.gstatic.com");    // the font files themselves
    expect(csp).toContain("https://*.vinted.net");         // offer thumbnails
    expect(csp).toContain("data:");                        // inline SVG favicon
  });

  it("applies to error responses too, not just successful ones", async () => {
    const res = await request(makeApp()).get("/boom");
    expect(res.status).toBe(500);
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["content-security-policy"]).toBeTruthy();
  });
});
