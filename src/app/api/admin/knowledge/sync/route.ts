import { z } from "zod";
import { guardApi, readJson } from "@/lib/auth/guard";
import { syncKnowledgeSources } from "@/lib/chatbot/web-knowledge";

const syncInputSchema = z.object({
  /** Tuỳ chọn: chủ đề cần làm mới. Bỏ trống = tự lấy từ thành phần của các sản phẩm đang bán. */
  topics: z.array(z.string().trim().min(2).max(80)).max(20).optional(),
});

/**
 * Làm mới KnowledgeSource từ internet (ADMIN / STAFF). Chỉ ghi bảng KnowledgeSource —
 * không bao giờ đụng giá, tồn kho hay voucher. Chưa cấu hình TAVILY_API_KEY → không gọi mạng.
 */
export async function POST(request: Request) {
  const guard = await guardApi(request, ["ADMIN", "STAFF"]);
  if (!guard.ok) return guard.response;

  const parsed = syncInputSchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  try {
    const report = await syncKnowledgeSources({ topics: parsed.data.topics });
    return Response.json(report);
  } catch (error) {
    console.error("[api/admin/knowledge/sync]", error);
    return Response.json({ error: "Không đồng bộ được kiến thức, vui lòng thử lại." }, { status: 500 });
  }
}
