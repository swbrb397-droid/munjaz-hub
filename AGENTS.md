<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Admin user management: privileged auth actions (email lookup, sign-in bans) run in `src/lib/admin-users.functions.ts` after a `has_role` check; profile/role/notification changes go through guarded `admin_*` SQL RPCs. Why: keeps service-role use server-side and every action audited.
- Referral payouts live in `public.pay_referral_commission`, called from the escrow trigger for both buyer and seller. Why: one place for 20%/10%/0% tiering.
- Gemini calls go through `src/lib/gemini-pool.server.ts` (chat/vision key pools from secrets, rotate on 429/RESOURCE_EXHAUSTED). Why: one place for failover; keys never in code.
- Instant digital purchases use the `purchase_digital_asset_instant` RPC. Why: charge, seller payout and referrals succeed or fail together.
- Admin role/ban/deactivate RPCs require aal2 and the UI gates them with MfaChallengeDialog. Why: no privileged change without fresh 2FA.
- Reviews are buyer-to-seller only (RLS + get_listing_reviews public RPC). Why: sellers cannot rate buyers.
- Instant purchases settle via 24h escrow: `purchase_digital_asset_instant` leaves orders `delivered` with `auto_release_at`; buyer uses `confirm_instant_delivery` / `open_instant_dispute`; the existing cron releases. Why: buyer protection without auto-refunds.
- Code audit flags on listings are writable only by service role (trigger); `src/lib/code-audit.functions.ts` runs the Gemini pool audit. Why: sellers cannot self-certify.
- Leaderboard ranking lives in the `get_merit_leaderboard` SQL function. Why: one tamper-proof formula.
- Order lifecycle emails go through `notifyOrderEvent` (`src/lib/order-email.functions.ts`) called fire-and-forget via `fireOrderEmail`. Why: mail failures never block order actions.
- Order chat integrity is enforced by the `order_messages_integrity` trigger (no edits/deletes once a dispute exists). Why: forensic evidence for arbitrators.
- Dispute splits use `admin_resolve_dispute(..., 'split', ..., _refund_pct)`, which pays out manually and clears `escrow_locked` before completing. Why: stops the escrow trigger paying the seller twice.
- Open projects/proposals are written only through SECURITY DEFINER RPCs (`create_project`, `submit_project_proposal`, `accept_project_proposal`, `admin_moderate_project`); accepting inserts a normal order and flips it to in_progress so `handle_order_escrow` locks funds. Why: one escrow engine, guards (contact filter, daily caps, frozen accounts) can't be bypassed.
- Presence uses `touch_presence` heartbeat + `get_presence` (respects `hide_online_status`). Why: no realtime load, privacy opt-out honoured server-side.
