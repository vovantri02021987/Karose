/**
 * Tra cứu / cập nhật kiến thức từ internet (Tavily Search API) — CHỈ để tham khảo thông tin thành phần,
 * công dụng, an toàn. Kết quả chỉ được ghi vào bảng KnowledgeSource; module này KHÔNG import hay sửa
 * giá, tồn kho, voucher hay đơn hàng.
 *
 * - Không có TAVILY_API_KEY → tắt hẳn, KHÔNG gọi mạng, trả về trạng thái "disabled".
 * - Mọi lời gọi có timeout; lỗi mạng/HTTP không ném ra ngoài mà trả về { ok:false, reason }.
 * - Chỉ nhận kết quả từ domain trong danh sách tin cậy (KNOWLEDGE_ALLOWED_DOMAINS, có mặc định).
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const TAVILY_URL = "https://api.tavily.com/search";
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_SUMMARY_CHARS = 600;
const MAX_TITLE_CHARS = 200;

export const DEFAULT_ALLOWED_DOMAINS = [
  "ncbi.nlm.nih.gov",
  "pubmed.ncbi.nlm.nih.gov",
  "nih.gov",
  "ec.europa.eu",
  "cir-safety.org",
  "dermnetnz.org",
  "aad.org",
  "healthline.com",
  "paulaschoice.com",
  "incidecoder.com",
  "ewg.org",
  "wikipedia.org",
];

/** Tập biến môi trường cần dùng (cho phép truyền giả khi test). */
export type EnvLike = Record<string, string | undefined>;

export interface WebSnippet {
  title: string;
  url: string;
  summary: string;
}

export type WebSearchResult =
  | { ok: true; results: WebSnippet[] }
  | { ok: false; reason: "disabled" | "timeout" | "http_error" | "network_error" | "bad_response"; message: string };

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface WebEnv {
  apiKey?: string;
  allowedDomains: string[];
}

export function readWebEnv(env: EnvLike = process.env): WebEnv {
  const apiKey = env.TAVILY_API_KEY?.trim() || undefined;
  const custom = (env.KNOWLEDGE_ALLOWED_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return { apiKey, allowedDomains: custom.length ? custom : DEFAULT_ALLOWED_DOMAINS };
}

export function isWebLookupEnabled(env: EnvLike = process.env): boolean {
  return Boolean(readWebEnv(env).apiKey);
}

/** URL https và host thuộc (hoặc là subdomain của) domain được phép. */
export function isAllowedUrl(rawUrl: string, allowedDomains: string[]): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return allowedDomains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/** Làm sạch văn bản lấy từ web: bỏ thẻ HTML, ký tự điều khiển, gộp khoảng trắng, cắt độ dài. */
export function cleanSnippet(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  const text = input
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

interface TavilyRaw {
  results?: { title?: unknown; url?: unknown; content?: unknown }[];
}

export async function searchWeb(
  query: string,
  opts: { maxResults?: number; timeoutMs?: number; env?: EnvLike; fetcher?: Fetcher } = {},
): Promise<WebSearchResult> {
  const { apiKey, allowedDomains } = readWebEnv(opts.env);
  if (!apiKey) {
    return { ok: false, reason: "disabled", message: "Chưa cấu hình TAVILY_API_KEY nên không tra cứu internet." };
  }
  const q = query.trim().slice(0, 300);
  if (!q) return { ok: true, results: [] };

  const fetcher: Fetcher = opts.fetcher ?? ((i, init) => fetch(i, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetcher(TAVILY_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        query: q,
        search_depth: "basic",
        max_results: Math.min(Math.max(opts.maxResults ?? 4, 1), 8),
        include_answer: false,
        include_raw_content: false,
        include_domains: allowedDomains,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, reason: "http_error", message: `Dịch vụ tra cứu trả về HTTP ${res.status}.` };
    }
    const data = (await res.json().catch(() => null)) as TavilyRaw | null;
    if (!data || !Array.isArray(data.results)) {
      return { ok: false, reason: "bad_response", message: "Dịch vụ tra cứu trả về dữ liệu không hợp lệ." };
    }
    const results: WebSnippet[] = [];
    for (const r of data.results) {
      const url = typeof r.url === "string" ? r.url : "";
      if (!isAllowedUrl(url, allowedDomains)) continue;
      const summary = cleanSnippet(r.content, MAX_SUMMARY_CHARS);
      const title = cleanSnippet(r.title, MAX_TITLE_CHARS) || new URL(url).hostname;
      if (!summary) continue;
      results.push({ title, url, summary });
    }
    return { ok: true, results };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return aborted
      ? { ok: false, reason: "timeout", message: "Tra cứu internet quá thời gian chờ." }
      : { ok: false, reason: "network_error", message: "Không kết nối được dịch vụ tra cứu internet." };
  } finally {
    clearTimeout(timer);
  }
}

type KnowledgeDb = Pick<PrismaClient, "knowledgeSource" | "product">;

/** Ghi kết quả web vào KnowledgeSource (upsert theo sourceUrl). Không đụng bảng nào khác. */
export async function saveKnowledge(
  snippets: WebSnippet[],
  category: string,
  db: KnowledgeDb = prisma,
  now: Date = new Date(),
): Promise<number> {
  let saved = 0;
  for (const s of snippets) {
    await db.knowledgeSource.upsert({
      where: { sourceUrl: s.url },
      create: { title: s.title, sourceUrl: s.url, summary: s.summary, category, syncedAt: now, isActive: true },
      update: { title: s.title, summary: s.summary, category, syncedAt: now },
    });
    saved += 1;
  }
  return saved;
}

/** Tên thành phần phổ biến không đáng tra cứu riêng. */
const GENERIC_INGREDIENTS = new Set(["aqua", "water", "nuoc", "parfum", "fragrance", "phenoxyethanol", "ethylhexylglycerin"]);

/** Tách danh sách INCI thành tên thành phần (bỏ trùng, bỏ thành phần chung chung). */
export function extractIngredientNames(inci: string, limit = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of inci.split(/[,;\n]/)) {
    const name = raw.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
    if (name.length < 3 || name.length > 60) continue;
    const key = name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    if (GENERIC_INGREDIENTS.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= limit) break;
  }
  return out;
}

export interface SyncReport {
  enabled: boolean;
  message: string;
  topics: string[];
  fetched: number;
  upserted: number;
  errors: string[];
}

/**
 * Làm mới KnowledgeSource từ internet theo các thành phần đang có trong catalog (hoặc `topics` truyền vào).
 * Không có API key → trả về enabled:false và KHÔNG thực hiện bất kỳ lời gọi mạng nào.
 */
export async function syncKnowledgeSources(
  opts: { db?: KnowledgeDb; topics?: string[]; maxTopics?: number; env?: EnvLike; fetcher?: Fetcher } = {},
): Promise<SyncReport> {
  const db = opts.db ?? prisma;
  if (!isWebLookupEnabled(opts.env)) {
    return {
      enabled: false,
      message: "Chưa cấu hình TAVILY_API_KEY — bỏ qua đồng bộ, dữ liệu hiện có giữ nguyên.",
      topics: [],
      fetched: 0,
      upserted: 0,
      errors: [],
    };
  }

  let topics = opts.topics?.map((t) => t.trim()).filter(Boolean);
  if (!topics || topics.length === 0) {
    const products = await db.product.findMany({ where: { isActive: true }, select: { ingredientsInci: true } });
    const seen = new Set<string>();
    topics = [];
    for (const p of products) {
      for (const name of extractIngredientNames(p.ingredientsInci)) {
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          topics.push(name);
        }
      }
    }
  }
  topics = topics.slice(0, opts.maxTopics ?? 10);

  const report: SyncReport = { enabled: true, message: "", topics, fetched: 0, upserted: 0, errors: [] };
  for (const topic of topics) {
    const res = await searchWeb(`${topic} cosmetic ingredient skin benefits safety`, {
      maxResults: 3,
      env: opts.env,
      fetcher: opts.fetcher,
    });
    if (!res.ok) {
      report.errors.push(`${topic}: ${res.message}`);
      if (res.reason === "http_error" || res.reason === "disabled") break; // key sai/hết hạn mức → dừng sớm
      continue;
    }
    report.fetched += res.results.length;
    try {
      report.upserted += await saveKnowledge(res.results, "INGREDIENT", db);
    } catch {
      report.errors.push(`${topic}: không ghi được vào cơ sở dữ liệu.`);
    }
  }
  report.message = `Đã tra cứu ${topics.length} chủ đề, lưu ${report.upserted} nguồn.`;
  return report;
}
