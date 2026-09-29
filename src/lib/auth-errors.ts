/** Translate raw auth error messages into natural Arabic (or clean English). */
const RULES: Array<[RegExp, string, string]> = [
  [/known to be weak|pwned|leaked|easy to guess|weak_password|weak password/i,
    "كلمة المرور هذه ضعيفة وسهلة التخمين عالمياً، يرجى اختيار كلمة مرور أكثر تعقيداً تحتوي على أحرف كبيرة وأرقام ورموز",
    "This password is weak and commonly guessed. Choose a stronger one with uppercase letters, numbers and symbols."],
  [/password should be at least|password.*characters/i,
    "كلمة المرور قصيرة جداً، يجب ألا تقل عن 8 خانات",
    "Password is too short (at least 8 characters)."],
  [/should be different from the old password|same_password/i,
    "كلمة المرور الجديدة يجب أن تختلف عن الحالية",
    "The new password must differ from the current one."],
  [/invalid login credentials|invalid credentials/i,
    "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    "Invalid email or password."],
  [/email not confirmed/i, "يرجى تأكيد البريد الإلكتروني أولاً", "Please confirm your email first."],
  [/user already registered|already registered/i,
    "هذا البريد مسجّل مسبقاً، سجّل الدخول بدلاً من ذلك",
    "This email is already registered. Sign in instead."],
  [/rate limit|too many requests|over_email_send_rate|for security purposes/i,
    "عدد المحاولات كبير — حاول مجدداً بعد قليل",
    "Too many attempts — please try again shortly."],
  [/expired|otp_expired|token has expired|invalid.*token|jwt/i,
    "انتهت صلاحية الرابط أو الرمز، يرجى طلب رمز جديد",
    "The link or code has expired. Please request a new one."],
  [/invalid totp|invalid mfa|mfa.*(invalid|failed)|challenge/i,
    "رمز المصادقة الثنائية غير صحيح أو انتهت صلاحيته",
    "The two-factor code is incorrect or expired."],
  [/nonce|reauthentication/i,
    "رمز التحقق المرسل إلى بريدك غير صحيح أو انتهت صلاحيته",
    "The email verification code is incorrect or expired."],
  [/aal2|insufficient_aal/i,
    "يلزم تأكيد المصادقة الثنائية لإتمام هذا الإجراء",
    "Two-factor verification is required for this action."],
  [/invalid email|unable to validate email/i, "صيغة البريد الإلكتروني غير صحيحة", "Invalid email address."],
  [/user not found/i, "لا يوجد حساب بهذا البريد", "No account with this email."],
  [/signups not allowed|signup.*disabled/i, "التسجيل مغلق مؤقتاً", "Sign-ups are temporarily disabled."],
  [/network|failed to fetch|fetch/i, "تعذّر الاتصال بالخادم — تحقق من الإنترنت", "Network error — check your connection."],
];

export function translateAuthError(err: unknown, ar = true): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  for (const [re, a, e] of RULES) if (re.test(raw)) return ar ? a : e;
  // Unknown message: never leak raw English in Arabic mode.
  if (ar && /[A-Za-z]{3,}/.test(raw) && !/[\u0600-\u06FF]/.test(raw)) {
    return "تعذّر إتمام العملية، يرجى المحاولة مرة أخرى";
  }
  return raw || (ar ? "تعذّر إتمام العملية، يرجى المحاولة مرة أخرى" : "Something went wrong. Please try again.");
}
