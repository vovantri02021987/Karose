/** Chuẩn hoá SĐT Việt Nam về dạng 0xxxxxxxxx để so khớp (bỏ khoảng trắng, +84/84 -> 0). */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+84")) return `0${digits.slice(3)}`;
  if (digits.startsWith("84") && digits.length === 11) return `0${digits.slice(2)}`;
  return digits.replace(/\D/g, "");
}

/** Che giữa SĐT: 0901234567 -> 090****567. */
export function maskPhone(phone: string): string {
  const p = normalizePhone(phone);
  if (p.length < 7) return p;
  return `${p.slice(0, 3)}****${p.slice(-3)}`;
}
