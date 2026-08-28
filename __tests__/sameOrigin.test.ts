/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { sameOrigin } from "../middleware/sameOrigin";

/** Minimal app with the middleware in the same position as in `app.ts`. */
const makeApp = () => {
  const app = express();
  app.use(sameOrigin());
  app.use(express.json());
  app.post("/api/sync-purify", (_req, res) => res.json({ ran: true }));
  app.get("/api/books", (_req, res) => res.json({ ok: true }));
  return app;
};

describe("sameOrigin (CSRF)", () => {
  it("allows a same-origin POST from the SPA", async () => {
    const res = await request(makeApp())
      .post("/api/sync-purify")
      .set("Host", "librem.example")
      .set("Origin", "https://librem.example");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ran: true });
  });

  it("rejects the cross-site form POST — the actual attack", async () => {
    const res = await request(makeApp())
      .post("/api/sync-purify")
      .set("Host", "librem.example")
      .set("Origin", "https://evil.example");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/CSRF/);
  });

  it("rejects a look-alike origin", async () => {
    const res = await request(makeApp())
      .post("/api/sync-purify")
      .set("Host", "librem.example")
      .set("Origin", "https://librem.example.evil.com");
    expect(res.status).toBe(403);
  });

  it("rejects an opaque origin (sandboxed iframe / redirect)", async () => {
    const res = await request(makeApp())
      .post("/api/sync-purify")
      .set("Host", "librem.example")
      .set("Origin", "null");
    expect(res.status).toBe(403);
  });

  it("falls back to Referer when Origin is absent", async () => {
    const app = makeApp();
    const ok = await request(app).post("/api/sync-purify")
      .set("Host", "librem.example").set("Referer", "https://librem.example/regal");
    expect(ok.status).toBe(200);

    const bad = await request(app).post("/api/sync-purify")
      .set("Host", "librem.example").set("Referer", "https://evil.example/page");
    expect(bad.status).toBe(403);
  });

  it("allows a non-browser client that sends neither header (curl, import script)", async () => {
    const res = await request(makeApp()).post("/api/sync-purify").set("Host", "librem.example");
    expect(res.status).toBe(200);
  });

  it("ignores GETs entirely — they change no state", async () => {
    const res = await request(makeApp())
      .get("/api/books")
      .set("Host", "librem.example")
      .set("Origin", "https://evil.example");
    expect(res.status).toBe(200);
  });

  it("matches on host only, so TLS termination at the proxy doesn't false-reject", async () => {
    // Externally https, internally the proxy may forward as http.
    const res = await request(makeApp())
      .post("/api/sync-purify")
      .set("Host", "librem.example")
      .set("Origin", "http://librem.example");
    expect(res.status).toBe(200);
  });

  it("distinguishes ports (dev servers on the same host)", async () => {
    const res = await request(makeApp())
      .post("/api/sync-purify")
      .set("Host", "localhost:3000")
      .set("Origin", "http://localhost:5173");
    expect(res.status).toBe(403);
  });
});
