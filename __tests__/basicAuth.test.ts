// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { basicAuth } from "../middleware/basicAuth";

function mkReq(headers: Record<string, string> = {}, path = "/") {
  return { headers, path } as any;
}
function mkRes() {
  const res: any = { statusCode: 200, headers: {}, body: undefined };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.send = vi.fn((b: any) => { res.body = b; return res; });
  return res;
}

const creds = () => ({ BASIC_AUTH_USER: "u", BASIC_AUTH_PASSWORD: "p" } as any);
const basic = (u: string, p: string) => "Basic " + Buffer.from(`${u}:${p}`).toString("base64");

describe("basicAuth", () => {
  it("is a no-op when credentials are not configured (opt-in in dev)", () => {
    const next = vi.fn();
    basicAuth(() => ({} as any))(mkReq(), mkRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  describe("fail-closed in production", () => {
    it("refuses to serve when credentials are missing (503, nothing passes through)", () => {
      const next = vi.fn();
      const res = mkRes();
      basicAuth(() => ({ NODE_ENV: "production" } as any))(mkReq({}, "/api/stats"), res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(503);
      expect(res.body).toMatch(/BASIC_AUTH_USER/);
    });

    it("keeps the health probe answering, so the host doesn't flap the service", () => {
      const next = vi.fn();
      basicAuth(() => ({ NODE_ENV: "production" } as any))(mkReq({}, "/api/health"), mkRes(), next);
      expect(next).toHaveBeenCalledOnce();
    });

    it("allows a deliberately public deployment via an explicit opt-out", () => {
      const next = vi.fn();
      basicAuth(() => ({ NODE_ENV: "production", ALLOW_PUBLIC_ACCESS: "true" } as any))(mkReq({}, "/api/stats"), mkRes(), next);
      expect(next).toHaveBeenCalledOnce();
    });

    it("does not accept a sloppy opt-out value", () => {
      const next = vi.fn();
      const res = mkRes();
      basicAuth(() => ({ NODE_ENV: "production", ALLOW_PUBLIC_ACCESS: "1" } as any))(mkReq({}, "/api/stats"), res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(503);
    });

    it("enforces normally once credentials ARE set in production", () => {
      const next = vi.fn();
      const res = mkRes();
      const env = () => ({ ...creds(), NODE_ENV: "production" } as any);
      basicAuth(env)(mkReq({}, "/api/stats"), res, next);
      expect(res.statusCode).toBe(401); // not 503 — configured, just unauthenticated

      const ok = vi.fn();
      basicAuth(env)(mkReq({ authorization: basic("u", "p") }, "/api/stats"), mkRes(), ok);
      expect(ok).toHaveBeenCalledOnce();
    });
  });

  it("always allows /api/health even when enabled", () => {
    const next = vi.fn();
    basicAuth(creds)(mkReq({}, "/api/health"), mkRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects a request with no/invalid credentials (401 + WWW-Authenticate)", () => {
    const next = vi.fn();
    const res = mkRes();
    basicAuth(creds)(mkReq({}, "/"), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.headers["WWW-Authenticate"]).toContain("Basic");
  });

  it("rejects wrong password", () => {
    const next = vi.fn();
    const res = mkRes();
    basicAuth(creds)(mkReq({ authorization: basic("u", "wrong") }, "/"), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("allows correct credentials", () => {
    const next = vi.fn();
    basicAuth(creds)(mkReq({ authorization: basic("u", "p") }, "/api/stats"), mkRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
