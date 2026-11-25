import { z } from "zod";
import { answerQuestion } from "@/lib/chatbot/engine";
import { classifyIntent } from "@/lib/chatbot/intent";
import { readJson } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";

const chatInputSchema = z.object({
  sessionId: z.string().trim().min(1).max(64).optional(),
  message: z
    .string({ error: "Vui lòng nhập câu hỏi" })
    .trim()
    .min(1, "Vui lòng nhập câu hỏi")
    .max(1000, "Câu hỏi quá dài (tối đa 1000 ký tự)"),
});

/** Chống spam theo phiên: tối đa 10 câu/phút và 200 câu/phiên. */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 10;
const MAX_MESSAGES_PER_SESSION = 400; // = 200 lượt hỏi (mỗi lượt gồm USER + ASSISTANT)

interface AssistantMeta {
  productSlugs?: string[];
}

function lastProductSlugs(meta: unknown): string[] {
  if (meta && typeof meta === "object" && Array.isArray((meta as AssistantMeta).productSlugs)) {
    return (meta as AssistantMeta).productSlugs!.filter((s): s is string => typeof s === "string").slice(0, 4);
  }
  return [];
}

export async function POST(request: Request) {
  const parsed = chatInputSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const { message } = parsed.data;

  try {
    // Phiên không tồn tại (hoặc không gửi) → tạo phiên mới thay vì báo lỗi.
    let sessionId: string | null = null;
    if (parsed.data.sessionId) {
      const existing = await prisma.chatSession.findUnique({ where: { id: parsed.data.sessionId }, select: { id: true } });
      sessionId = existing?.id ?? null;
    }
    if (!sessionId) {
      sessionId = (await prisma.chatSession.create({ data: {}, select: { id: true } })).id;
    } else {
      const since = new Date(Date.now() - RATE_WINDOW_MS);
      const [recent, total] = await Promise.all([
        prisma.chatMessage.count({ where: { sessionId, role: "USER", createdAt: { gte: since } } }),
        prisma.chatMessage.count({ where: { sessionId } }),
      ]);
      if (recent >= RATE_MAX_PER_WINDOW) {
        return Response.json({ error: "Bạn gửi câu hỏi quá nhanh, vui lòng đợi một chút rồi thử lại." }, { status: 429 });
      }
      if (total >= MAX_MESSAGES_PER_SESSION) {
        return Response.json({ error: "Cuộc trò chuyện đã đạt giới hạn, vui lòng bắt đầu cuộc trò chuyện mới." }, { status: 429 });
      }
    }

    const lastAssistant = await prisma.chatMessage.findFirst({
      where: { sessionId, role: "ASSISTANT" },
      orderBy: { createdAt: "desc" },
      select: { meta: true },
    });

    // 1) Lưu câu hỏi của khách (kèm ý định đã phân loại).
    const quick = classifyIntent(message);
    await prisma.chatMessage.create({
      data: { sessionId, role: "USER", content: message, intent: quick.intent },
    });

    // 2) Tư vấn từ dữ liệu DB (+ internet nếu cần).
    const result = await answerQuestion({
      message,
      recentProductSlugs: lastProductSlugs(lastAssistant?.meta),
    });

    // 3) Lưu câu trả lời.
    await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "ASSISTANT",
        content: result.reply,
        intent: result.intent.intent,
        meta: {
          productSlugs: result.recommendedProducts.map((p) => p.slug),
          sources: result.sources.map((x) => ({ title: x.title, url: x.url })),
          usedWebUpdate: result.usedWebUpdate,
          confidence: result.intent.confidence,
        },
      },
    });

    return Response.json({
      sessionId,
      intent: result.intent.intent,
      confidence: result.intent.confidence,
      reply: result.reply,
      recommendedProducts: result.recommendedProducts,
      sources: result.sources,
      usedWebUpdate: result.usedWebUpdate,
    });
  } catch (error) {
    console.error("[api/chat]", error);
    return Response.json({ error: "Trợ lý đang gặp sự cố, bạn vui lòng thử lại sau ít phút." }, { status: 500 });
  }
}
