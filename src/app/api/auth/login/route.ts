import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
} from "@/lib/auth/session";

const loginSchema = z.object({
  email: z.email("Email không hợp lệ").max(200),
  password: z.string().min(1, "Vui lòng nhập mật khẩu").max(200),
});

// Hash giả để thời gian phản hồi không lộ email có tồn tại hay không.
const DUMMY_HASH = "$2b$10$5l6fXpX1DziEVK05tBf8qecfSzIfeFH70.vFeo485AA6mH1ysjTkS";

const FAIL = { error: "Email hoặc mật khẩu không đúng" };

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return Response.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
  }
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 },
    );
  }
  const email = parsed.data.email.trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, role: true, passwordHash: true },
    });
    const valid = await bcrypt.compare(
      parsed.data.password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !user.passwordHash || !valid) {
      return Response.json(FAIL, { status: 401 });
    }
    if (user.role === "CUSTOMER") {
      return Response.json(
        { error: "Tài khoản này không có quyền truy cập trang quản trị" },
        { status: 403 },
      );
    }

    const token = await signSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
    return Response.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (e) {
    console.error("POST /api/auth/login failed", e);
    return Response.json(
      { error: "Không thể đăng nhập lúc này, vui lòng thử lại" },
      { status: 500 },
    );
  }
}
