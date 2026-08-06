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
  it("is a no-op when credentials are not configured (opt-in)", () => {
    const next = vi.fn();
    basicAuth(() => ({} as any))(mkReq(), mkRes(), next);
    expect(next).toHaveBeenCalledOnce();
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
