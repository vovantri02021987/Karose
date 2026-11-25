import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "./helpers/prisma";
import { cleanup, leftovers, makeUser } from "./helpers/factory";
import { cookieJar } from "./helpers/cookies";
import { loginAs, logout, patchStatus } from "./helpers/admin";
import { SESSION_COOKIE, signSession, verifySession } from "@/lib/auth/session";
import { guardApi, requireStaffPage } from "@/lib/auth/guard";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import PanelLayout from "@/app/admin/(panel)/layout";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

afterAll(async () => {
  await cleanup();
  expect(await leftovers()).toBe(0);
  await prisma.$disconnect();
});
beforeEach(() => logout());

type Handler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const adminRoutes = import.meta.glob("/src/app/api/admin/**/route.ts");

async function callAll(extraHeaders: Record<string, string> = {}) {
  const out: { route: string; method: string; status: number; message?: string }[] = [];
  for (const [file, load] of Object.entries(adminRoutes)) {
    const mod = (await load()) as Record<string, Handler | undefined>;
    for (const m of METHODS) {
      const fn = mod[m];
      if (!fn) continue;
      const res = await fn(
        new Request("http://localhost" + file, {
          method: m,
          headers: { "content-type": "application/json", ...extraHeaders },
          body: m === "GET" ? undefined : "{}",
        }),
        { params: Promise.resolve({ id: "khong-ton-tai" }) },
      );
      const body = await res.json().catch(() => ({}));
      out.push({ route: file.replace("/src/app/api", "").replace("/route.ts", ""), method: m, status: res.status, message: body?.error });
    }
  }
  return out;
}

async function redirectTarget(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    const err = e as { message?: string; digest?: string };
    if (err.message === "NEXT_REDIRECT" || String(err.digest ?? "").startsWith("NEXT_REDIRECT")) {
      return String(err.digest ?? "").split(";")[2] ?? "redirect";
    }
    throw e;
  }
}

describe("5. Phân quyền Admin & Staff", () => {
  it("5.0 Có route admin để kiểm (quét tự động, không bỏ sót route mới)", () => {
    expect(Object.keys(adminRoutes).length).toBeGreaterThanOrEqual(8);
  });

  it("5.1 API /api/admin/**: chưa đăng nhập → 401 cho MỌI route/method", async () => {
    const rs = await callAll();
    expect(rs.length).toBeGreaterThanOrEqual(10);
    const bad = rs.filter((r) => r.status !== 401);
    expect(bad, JSON.stringify(bad)).toEqual([]);
  });

  it("5.2 API /api/admin/**: tài khoản role=CUSTOMER (cookie hợp lệ) → 403 cho MỌI route/method", async () => {
    await loginAs(await makeUser("CUSTOMER"));
    const rs = await callAll();
    const bad = rs.filter((r) => r.status !== 403);
    expect(bad, JSON.stringify(bad)).toEqual([]);
  });

  it("5.3 ADMIN qua được mọi route (không 401/403)", async () => {
    await loginAs(await makeUser("ADMIN"));
    const rs = await callAll();
    const bad = rs.filter((r) => r.status === 401 || r.status === 403);
    expect(bad, JSON.stringify(bad)).toEqual([]);
  });

  it("5.4 STAFF qua được route dùng chung; route chỉ-ADMIN trả 403 đúng thông báo", async () => {
    await loginAs(await makeUser("STAFF"));
    const rs = await callAll();
    expect(rs.some((r) => r.status === 401)).toBe(false);
    for (const r of rs.filter((r) => r.status === 403)) {
      expect(r.message, `${r.method} ${r.route}`).toMatch(/Chỉ quản trị viên/);
    }
    // Nghiệp vụ kho/đơn hàng phải mở cho STAFF
    const allowed = (route: string, method: string) =>
      rs.find((r) => r.route === route && r.method === method)?.status;
    expect(allowed("/admin/orders/[id]/status", "PATCH")).not.toBe(403);
    expect(allowed("/admin/inventory/batches", "GET")).not.toBe(403);
    expect(allowed("/admin/inventory/batches", "POST")).not.toBe(403);
    // Thao tác nhạy cảm chỉ ADMIN: sửa sản phẩm, quản lý voucher
    expect(allowed("/admin/products/[id]", "PUT")).toBe(403);
    expect(allowed("/admin/vouchers", "POST")).toBe(403);
  });

  it("5.5 Trang /admin/**: chưa đăng nhập hoặc CUSTOMER → redirect /admin/login; STAFF/ADMIN vào được", async () => {
    expect(await redirectTarget(() => requireStaffPage())).toBe("/admin/login");
    expect(await redirectTarget(() => PanelLayout({ children: null }))).toBe("/admin/login");

    await loginAs(await makeUser("CUSTOMER"));
    expect(await redirectTarget(() => requireStaffPage())).toBe("/admin/login");

    for (const role of ["STAFF", "ADMIN"] as const) {
      await loginAs(await makeUser(role));
      const u = await requireStaffPage();
      expect(u.role).toBe(role);
      expect(await redirectTarget(() => PanelLayout({ children: null }))).toBeNull();
    }
  });

  it("5.6 Mọi page.tsx trong admin/(panel) tự kiểm quyền (không chỉ dựa vào layout); /admin/login thì không chặn", () => {
    const root = path.resolve(__dirname, "../src/app/admin");
    const pages: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = path.join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (n === "page.tsx") pages.push(p);
      }
    };
    walk(root);
    const panelPages = pages.filter((p) => p.includes(`${path.sep}(panel)${path.sep}`));
    expect(panelPages.length).toBeGreaterThanOrEqual(6);
    for (const p of panelPages) {
      expect(readFileSync(p, "utf8"), p).toMatch(/requireStaffPage\(|getStaffUser\(/);
    }
    const login = readFileSync(path.join(root, "login/page.tsx"), "utf8");
    expect(login).not.toMatch(/requireStaffPage/); // /admin/login phải truy cập được khi chưa đăng nhập
  });

  it("5.7 Đăng nhập: ADMIN & STAFF thành công, cookie phiên ký hợp lệ đúng role", async () => {
    for (const role of ["ADMIN", "STAFF"] as const) {
      const u = await makeUser(role, "MatKhau#12345");
      const res = await loginRoute(loginReq(u.email, "MatKhau#12345"));
      expect(res.status).toBe(200);
      expect((await res.json()).user).toMatchObject({ email: u.email, role });
      const s = await verifySession(cookieJar.get(SESSION_COOKIE));
      expect(s).toMatchObject({ id: u.id, role });
      cookieJar.delete(SESSION_COOKIE);
    }
  });

  it("5.8 Đăng nhập: CUSTOMER đúng mật khẩu → 403 và KHÔNG cấp cookie; sai mật khẩu / email lạ → 401", async () => {
    const c = await makeUser("CUSTOMER", "MatKhau#12345");
    const forbidden = await loginRoute(loginReq(c.email, "MatKhau#12345"));
    expect(forbidden.status).toBe(403);
    expect(cookieJar.get(SESSION_COOKIE)).toBeUndefined();

    const a = await makeUser("ADMIN", "MatKhau#12345");
    expect((await loginRoute(loginReq(a.email, "sai-mat-khau"))).status).toBe(401);
    expect((await loginRoute(loginReq("khong-ton-tai@test.local", "x"))).status).toBe(401);
    expect(cookieJar.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("5.9 Cookie giả mạo: sửa role trong payload / chữ ký sai / hết hạn → bị từ chối", async () => {
    const staff = await makeUser("STAFF");
    const good = await signSession({ id: staff.id, name: staff.name, email: staff.email, role: "STAFF" });
    const [body, sig] = good.split(".");
    const forgedPayload = JSON.parse(Buffer.from(body, "base64url").toString());
    forgedPayload.role = "ADMIN";
    const forgedBody = Buffer.from(JSON.stringify(forgedPayload)).toString("base64url");

    for (const token of [`${forgedBody}.${sig}`, `${body}.${sig.slice(0, -2)}AA`, "rac.roi", "", `${body}`]) {
      cookieJar.set(SESSION_COOKIE, token);
      const g = await guardApi(new Request("http://localhost/x", { method: "GET" }));
      expect(g.ok, token.slice(0, 20)).toBe(false);
    }
    const expired = await signSession({ id: staff.id, name: null, email: staff.email, role: "STAFF" }, -10);
    cookieJar.set(SESSION_COOKIE, expired);
    const g = await guardApi(new Request("http://localhost/x", { method: "GET" }));
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.response.status).toBe(401);
  });

  it("5.10 Thu hồi quyền có hiệu lực ngay: hạ role/xoá user trong DB → cookie cũ không còn dùng được", async () => {
    const u = await makeUser("ADMIN");
    await loginAs(u);
    expect((await guardApi(new Request("http://localhost/x"))).ok).toBe(true);
    await prisma.user.update({ where: { id: u.id }, data: { role: "CUSTOMER" } });
    const demoted = await guardApi(new Request("http://localhost/x"));
    expect(demoted.ok).toBe(false);
    if (!demoted.ok) expect(demoted.response.status).toBe(403);
    expect(await redirectTarget(() => requireStaffPage())).toBe("/admin/login");

    await prisma.user.delete({ where: { id: u.id } });
    const gone = await guardApi(new Request("http://localhost/x"));
    expect(gone.ok).toBe(false);
  });

  it("5.11 Chống CSRF: request ghi từ Origin lạ bị 403 dù có cookie ADMIN; cùng Origin thì qua", async () => {
    const a = await makeUser("ADMIN");
    await loginAs(a);
    const evil = await guardApi(new Request("http://localhost/api/x", { method: "PATCH", headers: { origin: "https://evil.example" } }));
    expect(evil.ok).toBe(false);
    if (!evil.ok) expect(evil.response.status).toBe(403);
    const same = await guardApi(new Request("http://localhost/api/x", { method: "PATCH", headers: { origin: "http://localhost" } }));
    expect(same.ok).toBe(true);
  });

  it("5.12 Đổi trạng thái đơn qua API thật: khách (CUSTOMER) và ẩn danh bị chặn, STAFF được phép", async () => {
    expect((await patchStatus("x", { status: "CANCELLED" })).status).toBe(401);
    await loginAs(await makeUser("CUSTOMER"));
    expect((await patchStatus("x", { status: "CANCELLED" })).status).toBe(403);
    await loginAs(await makeUser("STAFF"));
    expect((await patchStatus("x", { status: "CANCELLED" })).status).toBe(404); // qua guard, đơn không tồn tại
  });
});

function loginReq(email: string, password: string) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}
