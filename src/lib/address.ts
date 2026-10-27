/** Cryptographic payout-address validation shared by the wallet engine. */
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export type PayoutNetwork = "trc20" | "bep20" | "polygon";

export const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
export const TRON_ADDRESS_RE = /^T[a-zA-Z0-9]{33}$/;

export const EVM_ADDRESS_ERROR = "عنوان غير صالح لشبكة EVM (يجب أن يبدأ بـ 0x ويتكون من 42 خانة)";
export const TRON_ADDRESS_ERROR = "عنوان غير صالح لشبكة TRON (يجب أن يبدأ بـ T ويتكون من 34 خانة)";

/** Legacy rows sometimes stored an email address — treat those as garbage. */
export function isEmailLike(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v.includes("@") || v.includes("gmail");
}

/** Returns an Arabic error message, or null when the address is valid. */
export function validatePayoutAddress(address: string, network: PayoutNetwork): string | null {
  const value = address.trim();
  if (!value) return "يرجى إدخال عنوان محفظة السحب";
  if (isEmailLike(value)) {
    return network === "trc20" ? TRON_ADDRESS_ERROR : EVM_ADDRESS_ERROR;
  }
  if (network === "trc20") {
    return TRON_ADDRESS_RE.test(value) ? null : TRON_ADDRESS_ERROR;
  }
  if (!EVM_ADDRESS_RE.test(value)) return EVM_ADDRESS_ERROR;
  return isValidEvmChecksum(value) ? null : EVM_CHECKSUM_ERROR;
}

export const EVM_CHECKSUM_ERROR =
  "العنوان يحتوي على خطأ في الأحرف الكبيرة/الصغيرة (فشل فحص EIP-55) — انسخه مجدداً من محفظتك";

/** EIP-55: all-lower / all-upper addresses carry no checksum; mixed case must match. */
export function isValidEvmChecksum(address: string): boolean {
  const hex = address.slice(2);
  if (hex === hex.toLowerCase() || hex === hex.toUpperCase()) return true;
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(hex.toLowerCase())));
  for (let i = 0; i < 40; i++) {
    const c = hex[i];
    if (/[a-f]/i.test(c)) {
      const upper = parseInt(hash[i], 16) >= 8;
      if (upper !== (c === c.toUpperCase())) return false;
    }
  }
  return true;
}
