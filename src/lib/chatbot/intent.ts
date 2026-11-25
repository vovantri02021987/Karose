/**
 * Phân loại ý định câu hỏi của khách (thuần hàm, không phụ thuộc DB/mạng → test được, chạy được ở client).
 * Đọc câu hỏi tiếng Việt có/không dấu, chấm điểm theo từ khoá có trọng số cho từng nhóm ý định.
 */
import { normalizeText } from "@/lib/text";

export const CHAT_INTENTS = [
  "PRODUCT_USAGE_INCI",
  "PRODUCT_RECOMMENDATION",
  "ORDER_SHIPPING_PROMO",
  "WEB_KNOWLEDGE_UPDATE",
  "SAFETY_MEDICAL_BOUNDARY",
] as const;

export type ChatIntent = (typeof CHAT_INTENTS)[number];

export interface IntentResult {
  intent: ChatIntent;
  /** 0..1 — mức chắc chắn của phân loại (thấp = câu hỏi mơ hồ, đã dùng ý định mặc định). */
  confidence: number;
  matchedKeywords: string[];
  scores: Record<ChatIntent, number>;
  /**
   * Có dấu hiệu nhạy cảm da liễu/y tế dù ý định chính là nhóm khác
   * (vd: "serum này dùng cho da bị ngứa được không") → luôn kèm lưu ý an toàn.
   */
  safetyFlag: boolean;
}

interface Keyword {
  /** Viết KHÔNG dấu, chữ thường. */
  kw: string;
  weight: number;
}

const k = (kw: string, weight = 1): Keyword => ({ kw, weight });

const KEYWORDS: Record<ChatIntent, Keyword[]> = {
  PRODUCT_USAGE_INCI: [
    k("thanh phan", 3),
    k("inci", 3),
    k("cach dung", 3),
    k("cach su dung", 3),
    k("su dung nhu the nao", 3),
    k("dung nhu the nao", 3),
    k("dung the nao", 3),
    k("dung ra sao", 3),
    k("huong dan", 2),
    k("bao quan", 3),
    k("han su dung", 3),
    k("hsd", 2),
    k("cong dung", 3),
    k("tac dung", 2),
    k("loi ich", 2),
    k("chiet xuat", 2),
    k("co chua", 2),
    k("chua gi", 2),
    k("dung khi nao", 2),
    k("buoi sang", 1),
    k("buoi toi", 1),
    k("moi ngay", 1),
    k("may lan", 1),
    k("thu tu", 1),
    k("dung chung", 2),
    k("ket hop", 1),
    k("bao lau het", 1),
    k("sau khi mo", 2),
  ],
  PRODUCT_RECOMMENDATION: [
    k("goi y", 3),
    k("tu van", 2),
    k("nen dung", 3),
    k("nen mua", 3),
    k("phu hop", 2),
    k("da dau", 2),
    k("da kho", 2),
    k("da hon hop", 2),
    k("da nhay cam", 2),
    k("da thuong", 2),
    k("da mun", 2),
    k("da xin mau", 1),
    k("cho da", 2),
    k("loai nao", 2),
    k("san pham nao", 3),
    k("combo", 2),
    k("muon mua", 2),
    k("tim san pham", 2),
    k("duong am", 1),
    k("chong nang", 1),
    k("tay trang", 1),
    k("sua rua mat", 1),
    k("nuoc hoa hong", 1),
    k("duong da", 1),
    k("kem duong", 1),
    k("serum", 1),
    k("toner", 1),
    k("moi bat dau", 1),
    k("qua tang", 2),
  ],
  ORDER_SHIPPING_PROMO: [
    k("giao hang", 3),
    k("van chuyen", 3),
    k("phi ship", 3),
    k("phi van chuyen", 3),
    k("freeship", 3),
    k("mien phi van chuyen", 3),
    k("khi nao nhan", 3),
    k("nhan hang", 2),
    k("bao lau nhan", 3),
    k("bao nhieu ngay", 2),
    k("ma giam", 3),
    k("voucher", 3),
    k("coupon", 3),
    k("khuyen mai", 3),
    k("giam gia", 3),
    k("uu dai", 2),
    k("thanh toan", 2),
    k("cod", 2),
    k("vietqr", 3),
    k("chuyen khoan", 2),
    k("doi tra", 3),
    k("hoan tien", 3),
    k("huy don", 3),
    k("don hang", 2),
    k("ma don", 2),
    k("theo doi don", 3),
    k("tra cuu don", 3),
    k("tracking", 2),
    k("gia bao nhieu", 3),
    k("bao nhieu tien", 3),
    k("gia tien", 2),
    k("gia ban", 2),
    k("con hang", 3),
    k("het hang", 3),
    k("ton kho", 2),
    k("dat hang", 2),
    k("mua hang", 1),
  ],
  WEB_KNOWLEDGE_UPDATE: [
    k("moi nhat", 3),
    k("cap nhat", 2),
    k("nghien cuu", 3),
    k("bai bao", 3),
    k("tren mang", 3),
    k("tren internet", 3),
    k("tren web", 3),
    k("tim tren", 2),
    k("tra cuu", 2),
    k("tim hieu them", 3),
    k("xu huong", 2),
    k("khoa hoc", 2),
    k("chung minh", 2),
    k("co that khong", 2),
    k("hieu qua that", 2),
    k("fda", 2),
    k("cosing", 3),
    k("ewg", 3),
    k("nguon", 2),
    k("trich dan", 3),
    k("la gi", 1),
    k("review", 1),
  ],
  SAFETY_MEDICAL_BOUNDARY: [
    k("di ung", 3),
    k("kich ung", 3),
    k("mun viem", 3),
    k("mun bong", 3),
    k("mun trung ca", 3),
    k("viem da", 3),
    k("viem nang long", 3),
    k("man do", 3),
    k("phat ban", 3),
    k("bi ngua", 3),
    k("ngua", 2),
    k("bi rat", 3),
    k("bong rat", 3),
    k("sung tay", 3),
    k("sung mat", 3),
    k("sung do", 3),
    k("cham da", 3),
    k("eczema", 3),
    k("vay nen", 3),
    k("nhiem trung", 3),
    k("nhiem khuan", 3),
    k("chay mau", 3),
    k("benh da", 3),
    k("benh", 2),
    k("dieu tri", 3),
    k("chua tri", 3),
    k("chua benh", 3),
    k("chua khoi", 3),
    k("thuoc", 2),
    k("bac si", 3),
    k("da lieu", 3),
    k("mang thai", 3),
    k("co bau", 3),
    k("cho con bu", 3),
    k("tre so sinh", 3),
    k("em be", 2),
    k("tre em", 2),
    k("sau phau thuat", 3),
    k("sau laser", 3),
    k("sau peel", 3),
    k("shock phan ve", 3),
    k("kho tho", 3),
    k("noi me day", 3),
    k("da bi ton thuong", 3),
    k("da dang ton thuong", 3),
    k("vet thuong ho", 3),
  ],
};

/** Số điểm an toàn tối thiểu để ưu tiên nhóm SAFETY_MEDICAL_BOUNDARY bất kể nhóm khác. */
const SAFETY_OVERRIDE_SCORE = 3;
/** Thứ tự ưu tiên khi hoà điểm. */
const TIE_BREAK: ChatIntent[] = [
  "SAFETY_MEDICAL_BOUNDARY",
  "ORDER_SHIPPING_PROMO",
  "PRODUCT_USAGE_INCI",
  "WEB_KNOWLEDGE_UPDATE",
  "PRODUCT_RECOMMENDATION",
];
const DEFAULT_INTENT: ChatIntent = "PRODUCT_RECOMMENDATION";

/** Chuẩn hoá về chuỗi không dấu, ký tự lạ → khoảng trắng, bao bởi khoảng trắng để khớp nguyên từ. */
export function normalizeForIntent(message: string): string {
  const base = normalizeText(message).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  return ` ${base} `;
}

function emptyScores(): Record<ChatIntent, number> {
  return {
    PRODUCT_USAGE_INCI: 0,
    PRODUCT_RECOMMENDATION: 0,
    ORDER_SHIPPING_PROMO: 0,
    WEB_KNOWLEDGE_UPDATE: 0,
    SAFETY_MEDICAL_BOUNDARY: 0,
  };
}

export function classifyIntent(message: string): IntentResult {
  const text = normalizeForIntent(message);
  const scores = emptyScores();
  const matched: string[] = [];
  const matchedByIntent: Record<ChatIntent, string[]> = {
    PRODUCT_USAGE_INCI: [],
    PRODUCT_RECOMMENDATION: [],
    ORDER_SHIPPING_PROMO: [],
    WEB_KNOWLEDGE_UPDATE: [],
    SAFETY_MEDICAL_BOUNDARY: [],
  };

  for (const intent of CHAT_INTENTS) {
    for (const { kw, weight } of KEYWORDS[intent]) {
      if (text.includes(` ${kw} `)) {
        scores[intent] += weight;
        matchedByIntent[intent].push(kw);
      }
    }
  }

  const safetyFlag = scores.SAFETY_MEDICAL_BOUNDARY > 0;
  let intent: ChatIntent;
  if (scores.SAFETY_MEDICAL_BOUNDARY >= SAFETY_OVERRIDE_SCORE) {
    intent = "SAFETY_MEDICAL_BOUNDARY";
  } else {
    let best: ChatIntent | null = null;
    for (const candidate of TIE_BREAK) {
      if (scores[candidate] === 0) continue;
      if (best === null || scores[candidate] > scores[best]) best = candidate;
    }
    intent = best ?? DEFAULT_INTENT;
  }

  matched.push(...matchedByIntent[intent]);
  // Từ khoá an toàn luôn được báo lại để UI/log thấy lý do hiện lưu ý.
  if (intent !== "SAFETY_MEDICAL_BOUNDARY") matched.push(...matchedByIntent.SAFETY_MEDICAL_BOUNDARY);

  const top = scores[intent];
  if (top === 0) {
    return { intent, confidence: 0.25, matchedKeywords: [], scores, safetyFlag };
  }
  const second = Math.max(
    0,
    ...CHAT_INTENTS.filter((i) => i !== intent).map((i) => scores[i]),
  );
  const confidence = Math.round(Math.min(0.99, top / (top + second + 1)) * 100) / 100;
  return { intent, confidence, matchedKeywords: [...new Set(matched)], scores, safetyFlag };
}
