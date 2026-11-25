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

// ---------------------------------------------------------------------------------------------
// Đọc trực tiếp một trang web tin cậy (dùng cho UPSERT_SOURCE / REFRESH_EXISTING)
// ---------------------------------------------------------------------------------------------
const MAX_PAGE_BYTES = 300_000;
const MAX_REDIRECTS = 3;

export type PageResult =
  | { ok: true; url: string; title: string; summary: string }
  | { ok: false; reason: "not_allowed" | "timeout" | "http_error" | "network_error" | "unsupported" | "empty"; message: string };

/** https, không kèm tài khoản/cổng tuỳ ý, không phải địa chỉ IP, và thuộc domain được phép. */
export function isSafeFetchUrl(rawUrl: string, allowedDomains: string[]): boolean {
  if (!isAllowedUrl(rawUrl, allowedDomains)) return false;
  const u = new URL(rawUrl);
  if (u.username || u.password) return false;
  if (u.port && u.port !== "443") return false;
  if (/^[\d.]+$/.test(u.hostname) || u.hostname.includes(":")) return false; // IPv4 / IPv6
  return true;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n);
      return code > 31 && code < 0x10ffff ? String.fromCodePoint(code) : " ";
    });
}

function metaContent(html: string, key: string): string {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeEntities(content) : "";
}

/** Trích tiêu đề + tóm tắt an toàn từ HTML (bỏ script/style/điều hướng, không thực thi gì). */
export function extractPageSummary(html: string): { title: string; summary: string } {
  const title = cleanSnippet(
    metaContent(html, "og:title") || decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
    MAX_TITLE_CHARS,
  );
  const description = cleanSnippet(metaContent(html, "description") || metaContent(html, "og:description"), MAX_SUMMARY_CHARS);
  const body = decodeEntities(
    html
      .replace(/<(script|style|noscript|nav|header|footer|aside|svg|form)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " "),
  );
  const text = cleanSnippet(body, MAX_SUMMARY_CHARS);
  const summary = description.length >= 80 ? description : cleanSnippet(`${description} ${text}`, MAX_SUMMARY_CHARS);
  return { title, summary };
}

async function readLimited(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return (await res.text()).slice(0, maxBytes);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const merged = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const c of chunks) {
    const slice = c.subarray(0, merged.length - offset);
    merged.set(slice, offset);
    offset += slice.byteLength;
    if (offset >= merged.length) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

/**
 * Tải một trang từ domain tin cậy và rút tiêu đề/tóm tắt. Chuyển hướng được kiểm tra lại từng bước;
 * có timeout và giới hạn dung lượng; lỗi trả về { ok:false } chứ không ném.
 */
export async function fetchPageSummary(
  rawUrl: string,
  opts: { env?: EnvLike; fetcher?: Fetcher; timeoutMs?: number } = {},
): Promise<PageResult> {
  const { allowedDomains } = readWebEnv(opts.env);
  const fetcher: Fetcher = opts.fetcher ?? ((i, init) => fetch(i, init));
  let current = rawUrl.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (!isSafeFetchUrl(current, allowedDomains)) {
        return { ok: false, reason: "not_allowed", message: "Địa chỉ không thuộc nguồn tin cậy được phép (chỉ https, đúng domain trong danh sách)." };
      }
      const res = await fetcher(current, {
        method: "GET",
        redirect: "manual",
        headers: { accept: "text/html,text/plain;q=0.9", "user-agent": "KaRoseKnowledgeBot/1.0" },
        signal: controller.signal,
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return { ok: false, reason: "http_error", message: "Trang chuyển hướng không hợp lệ." };
        current = new URL(location, current).toString();
        continue;
      }
      if (!res.ok) return { ok: false, reason: "http_error", message: `Trang trả về HTTP ${res.status}.` };
      const type = res.headers.get("content-type") ?? "";
      if (!/text\/(html|plain)|application\/xhtml/i.test(type)) {
        return { ok: false, reason: "unsupported", message: "Chỉ hỗ trợ trang HTML hoặc văn bản thuần." };
      }
      const raw = await readLimited(res, MAX_PAGE_BYTES);
      const { title, summary } = /text\/plain/i.test(type)
        ? { title: "", summary: cleanSnippet(raw, MAX_SUMMARY_CHARS) }
        : extractPageSummary(raw);
      if (!summary) return { ok: false, reason: "empty", message: "Không rút được nội dung từ trang." };
      return { ok: true, url: current, title: title || new URL(current).hostname, summary };
    }
    return { ok: false, reason: "http_error", message: "Quá nhiều lần chuyển hướng." };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return aborted
      ? { ok: false, reason: "timeout", message: "Tải trang quá thời gian chờ." }
      : { ok: false, reason: "network_error", message: "Không tải được trang." };
  } finally {
    clearTimeout(timer);
  }
}

export interface SourceSyncReport {
  mode: "REFRESH_EXISTING" | "UPSERT_SOURCE";
  checked: number;
  updated: number;
  failed: number;
  errors: string[];
  message: string;
}

/** Thêm/cập nhật một nguồn theo URL (tải nội dung thật). */
export async function upsertKnowledgeSource(
  input: { url: string; title?: string; category?: string },
  opts: { db?: KnowledgeDb; env?: EnvLike; fetcher?: Fetcher } = {},
): Promise<SourceSyncReport> {
  const db = opts.db ?? prisma;
  const page = await fetchPageSummary(input.url, opts);
  if (!page.ok) {
    return { mode: "UPSERT_SOURCE", checked: 1, updated: 0, failed: 1, errors: [page.message], message: page.message };
  }
  const title = input.title?.trim() ? cleanSnippet(input.title, MAX_TITLE_CHARS) : page.title;
  const category = input.category?.trim() || "GENERAL";
  const now = new Date();
  await db.knowledgeSource.upsert({
    where: { sourceUrl: page.url },
    create: { title, sourceUrl: page.url, summary: page.summary, category, syncedAt: now, isActive: true },
    update: { title, summary: page.summary, category, syncedAt: now },
  });
  return { mode: "UPSERT_SOURCE", checked: 1, updated: 1, failed: 0, errors: [], message: `Đã lưu nguồn: ${title}` };
}

/** Làm mới nội dung các nguồn đang bật (hoặc theo `ids`). Nguồn lỗi giữ nguyên nội dung cũ. */
export async function refreshKnowledgeSources(
  opts: { db?: KnowledgeDb; ids?: string[]; limit?: number; env?: EnvLike; fetcher?: Fetcher } = {},
): Promise<SourceSyncReport> {
  const db = opts.db ?? prisma;
  const sources = await db.knowledgeSource.findMany({
    where: { isActive: true, ...(opts.ids?.length ? { id: { in: opts.ids } } : {}) },
    orderBy: { syncedAt: "asc" },
    take: opts.limit ?? 30,
    select: { id: true, title: true, sourceUrl: true },
  });
  const report: SourceSyncReport = { mode: "REFRESH_EXISTING", checked: sources.length, updated: 0, failed: 0, errors: [], message: "" };
  for (const s of sources) {
    const page = await fetchPageSummary(s.sourceUrl, opts);
    if (!page.ok) {
      report.failed += 1;
      report.errors.push(`${s.title}: ${page.message}`);
      continue;
    }
    await db.knowledgeSource.update({
      where: { id: s.id },
      data: { summary: page.summary, syncedAt: new Date() },
    });
    report.updated += 1;
  }
  report.message = `Đã làm mới ${report.updated}/${report.checked} nguồn${report.failed ? `, ${report.failed} nguồn lỗi` : ""}.`;
  return report;
}
