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
