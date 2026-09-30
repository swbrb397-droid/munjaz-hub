# Hardening & Branding Overhaul (7 modules)

Surgical additions only. Pure SPA stays on. No mock data.

## 1. Admin 2FA step-up gate (/admin/users)
- Before "ترقية إلى مشرف عام", "ترقية إلى مراقب", "حظر الحساب" and "تعطيل الحساب", open the existing `MfaChallengeDialog` titled "تأكيد أمني مطلوب - أدخل رمز المصادقة الثنائية (2FA)".
- The action runs only after `challengeAndVerify` succeeds. If the admin has no 2FA set up, the action is blocked with a message linking to the profile page.
- Server side: `admin_adjust_user_role`, `admin_toggle_user_ban` and `admin_deactivate_user` also reject calls from sessions that have not passed 2FA (aal2), so the check can't be skipped from the browser.

## 2. Turning off 2FA (profile security panel)
- "تعطيل 2FA" opens a new "تعطيل المصادقة الثنائية" window with a 6-digit code box and the text "أدخل رمز الـ 6 أرقام الحالي من تطبيق المصادقة لتأكيد إيقاف الحماية".
- The code is verified first, then the factor is removed. After that, a success notice appears and the security badge updates right away.

## 3. Faster admin users directory
- New database function `admin_get_users_directory()`, checked with `has_role` admin. It returns profile, wallet, roles, latest KYC and referral totals in one call.
- Indexes on `user_roles(user_id)`, `kyc_submissions(user_id, created_at desc)`, `referrals(referrer_id)` and `wallets(user_id)`.
- `adminListUsers` calls the new function and adds emails from the sign-in service. The page stays the same.

## 4. Buyer-only reviews
- `reviews` gains `quality`, `communication` and `punctuality` (1–5). The overall `rating` is their rounded average, and `comment` holds "ملاحظات إضافية".
- A database rule allows a review only from the order's buyer, only when the order is completed, and only once per order.
- The existing rating triggers update the seller profile and listing averages. `listings` gains `reviews_count`.
- The seller-rates-buyer ("تقييم متبادل") option is removed from the order page. Only the buyer sees the 3-part review form.
- `listing.$id.tsx` gets a public "تقييمات وآراء المشترين" section with real reviews.

## 5. Category selector (create listing)
- Replace the plain radio list with glass cards: Code2 in emerald, GraduationCap in blue, Boxes in purple, Gamepad2 in amber. The selected card gets a glowing border and a check badge. Stored values stay the same.

## 6. Brand icons
- `public/favicon.svg`: dark `#0B0F19` rounded tile, with a "م" plus checkmark in an emerald-to-cyan gradient.
- Generate `favicon.ico`, `apple-touch-icon.png` (180), `pwa-192x192.png` and `pwa-512x512.png` from the SVG. Add `public/manifest.json` with the requested name, colors and icons.
- This app has no `index.html`, so the icon, theme-color, application-name and manifest links go in the root head.

## 7. SEO
- `robots.txt`: keep the existing bot blocks and add the requested Disallow lines plus the Sitemap line.
- `sitemap.xml`: includes `/`, `/store` (the real marketplace page; `/marketplace` doesn't exist) and `/auth`, plus the other public pages (pricing, leaderboard, terms).
- Homepage head: the requested title, description, keywords, og:title/description, og:url `https://almunjazhub.com` and canonical. og:image is left out unless a real hosted image is supplied.

## Technical notes
- One migration covers the RPC, indexes, review columns and triggers, and the aal2 checks. Types regenerate before the code changes.
- Verify with tsc and signed-in Playwright checks of admin users, the 2FA disable window, the category cards and the listing reviews.
