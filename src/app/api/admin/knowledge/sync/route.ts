import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { guardApi, readJson } from "@/lib/auth/guard";
import {
  refreshKnowledgeSources,
  syncKnowledgeSources,
  upsertKnowledgeSource,
} from "@/lib/chatbot/web-knowledge";

const syncInputSchema = z.object({
  /**
   * REFRESH_EXISTING: tải lại nội dung các nguồn đang bật.
   * UPSERT_SOURCE: thêm/cập nhật một nguồn theo `url`.
   * SEARCH (mặc định): tra cứu theo thành phần sản phẩm qua Tavily (cần TAVILY_API_KEY).
   */
  mode: z.enum(["REFRESH_EXISTING", "UPSERT_SOURCE", "SEARCH"]).default("SEARCH"),
  url: z.string().trim().url("Địa chỉ nguồn không hợp lệ").max(500).optional(),
  title: z.string().trim().max(200).optional(),
  category: z.string().trim().min(1).max(40).optional(),
  ids: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  topics: z.array(z.string().trim().min(2).max(80)).max(20).optional(),
});

/** So sánh bí mật không lộ thời gian xử lý. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Xác thực: phiên ADMIN/STAFF, hoặc `Authorization: Bearer <KNOWLEDGE_SYNC_SECRET>` (cho cron/CI).
 * Có header Bearer mà sai/chưa cấu hình → 401, không rơi sang phiên đăng nhập.
 */
async function authorize(request: Request): Promise<Response | null> {
  const header = request.headers.get("authorization");
  if (header && /^bearer\s/i.test(header)) {
    const expected = process.env.KNOWLEDGE_SYNC_SECRET?.trim();
    const provided = header.replace(/^bearer\s+/i, "").trim();
    if (expected && provided && secretMatches(provided, expected)) return null;
    return Response.json({ error: "Khoá đồng bộ không hợp lệ" }, { status: 401 });
  }
  const guard = await guardApi(request, ["ADMIN", "STAFF"]);
  return guard.ok ? null : guard.response;
}

/**
 * Làm mới KnowledgeSource từ internet. Chỉ ghi bảng KnowledgeSource — không bao giờ đụng giá,
 * tồn kho, voucher hay đơn hàng. Chỉ tải từ domain trong KNOWLEDGE_ALLOWED_DOMAINS.
 */
export async function POST(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;

  const parsed = syncInputSchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    if (d.mode === "UPSERT_SOURCE") {
      if (!d.url) return Response.json({ error: "Vui lòng nhập địa chỉ nguồn (url)" }, { status: 400 });
      const report = await upsertKnowledgeSource({ url: d.url, title: d.title, category: d.category });
      return Response.json(report, { status: report.failed ? 422 : 200 });
    }
    if (d.mode === "REFRESH_EXISTING") {
      return Response.json(await refreshKnowledgeSources({ ids: d.ids }));
    }
    return Response.json(await syncKnowledgeSources({ topics: d.topics }));
  } catch (error) {
    console.error("[api/admin/knowledge/sync]", error);
    return Response.json({ error: "Không đồng bộ được kiến thức, vui lòng thử lại." }, { status: 500 });
  }
}
