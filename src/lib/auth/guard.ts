import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSessionCookie, type StaffRole } from "./session";

export interface StaffUser {
  id: string;
  name: string | null;
  email: string;
  role: StaffRole;
}

/** Đọc session rồi đối chiếu lại DB (role có thể đã bị thu hồi sau khi cấp cookie). */
export async function getStaffUser(): Promise<StaffUser | null> {
  const session = await readSessionCookie();
  if (!session || session.role === "CUSTOMER") return null;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF")) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** Dùng trong Server Component / layout: chưa đăng nhập → /admin/login. */
export async function requireStaffPage(): Promise<StaffUser> {
  const user = await getStaffUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** Trang chỉ dành cho ADMIN; STAFF bị đưa về dashboard. */
export async function requireAdminPage(): Promise<StaffUser> {
  const user = await requireStaffPage();
  if (user.role !== "ADMIN") redirect("/admin/dashboard?denied=1");
  return user;
}

type GuardResult =
  | { ok: true; user: StaffUser }
  | { ok: false; response: Response };

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // cùng origin thường không gửi Origin với GET; mutating từ trình duyệt luôn có
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/**
 * Bảo vệ API admin: 401 chưa đăng nhập, 403 sai quyền / sai origin (chống CSRF).
 * `roles` mặc định cho cả ADMIN và STAFF.
 */
export async function guardApi(
  request: Request,
  roles: StaffRole[] = ["ADMIN", "STAFF"],
): Promise<GuardResult> {
  if (request.method !== "GET" && !sameOrigin(request)) {
    return { ok: false, response: Response.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 }) };
  }
  const session = await readSessionCookie();
  if (!session) {
    return { ok: false, response: Response.json({ error: "Vui lòng đăng nhập" }, { status: 401 }) };
  }
  const user = await getStaffUser();
  if (!user) {
    return { ok: false, response: Response.json({ error: "Bạn không có quyền truy cập" }, { status: 403 }) };
  }
  if (!roles.includes(user.role)) {
    return {
      ok: false,
      response: Response.json({ error: "Chỉ quản trị viên (ADMIN) được thực hiện thao tác này" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}

export async function readJson(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
