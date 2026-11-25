/**
 * Mã đơn hàng ngắn + URL ảnh VietQR động (img.vietqr.io).
 */

// Bỏ các ký tự dễ nhầm (0/O, 1/I) để khách gõ nội dung chuyển khoản không sai.
const ORDER_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const ORDER_CODE_PREFIX = "KR";
export const ORDER_CODE_RANDOM_LENGTH = 6;

/** Sinh orderCode dạng KR + 6 ký tự in hoa/số, ví dụ KR7H3K9P. */
export function generateOrderCode(): string {
  const bytes = new Uint8Array(ORDER_CODE_RANDOM_LENGTH);
  crypto.getRandomValues(bytes);
  let out = ORDER_CODE_PREFIX;
  for (const b of bytes) {
    out += ORDER_CODE_ALPHABET[b % ORDER_CODE_ALPHABET.length];
  }
  return out;
}

/** Tìm các orderCode có thể có trong nội dung chuyển khoản (đã in hoa). */
export function extractOrderCodes(content: string): string[] {
  const upper = content.toUpperCase();
  const found = new Set<string>();
  const re = new RegExp(
    `${ORDER_CODE_PREFIX}[A-Z0-9]{${ORDER_CODE_RANDOM_LENGTH}}`,
    "g",
  );
  for (const m of upper.matchAll(re)) found.add(m[0]);
  return [...found];
}

export class VietQRConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VietQRConfigError";
  }
}

/** URL ảnh QR chuẩn Napas, điền sẵn số tiền + nội dung = orderCode. */
export function generateVietQRUrl(params: {
  amount: number;
  orderCode: string;
}): string {
  const bankId = process.env.VIETQR_BANK_ID;
  const accountNo = process.env.VIETQR_ACCOUNT_NO;
  const accountName = process.env.VIETQR_ACCOUNT_NAME;
  if (!bankId || !accountNo || !accountName) {
    throw new VietQRConfigError(
      "Chưa cấu hình VIETQR_BANK_ID / VIETQR_ACCOUNT_NO / VIETQR_ACCOUNT_NAME",
    );
  }
  const qs = new URLSearchParams({
    amount: String(Math.round(params.amount)),
    addInfo: params.orderCode,
    accountName,
  });
  return `https://img.vietqr.io/image/${encodeURIComponent(bankId)}-${encodeURIComponent(accountNo)}-compact2.png?${qs.toString()}`;
}

export interface VietQRBankInfo {
  bankId: string;
  bankName: string;
  accountNo: string;
  accountName: string;
}

// Mã BIN Napas của một số ngân hàng phổ biến (để hiển thị tên thay vì chỉ hiện mã).
const BANK_NAMES: Record<string, string> = {
  "970436": "Vietcombank",
  "970415": "VietinBank",
  "970418": "BIDV",
  "970405": "Agribank",
  "970407": "Techcombank",
  "970422": "MB Bank",
  "970423": "TPBank",
  "970432": "VPBank",
  "970416": "ACB",
  "970403": "Sacombank",
};

/** Thông tin tài khoản nhận tiền; trả null nếu chưa cấu hình biến môi trường. */
export function getVietQRBankInfo(): VietQRBankInfo | null {
  const bankId = process.env.VIETQR_BANK_ID;
  const accountNo = process.env.VIETQR_ACCOUNT_NO;
  const accountName = process.env.VIETQR_ACCOUNT_NAME;
  if (!bankId || !accountNo || !accountName) return null;
  return {
    bankId,
    bankName: BANK_NAMES[bankId] ?? bankId,
    accountNo,
    accountName,
  };
}
