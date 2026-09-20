import { auth, defineMcp } from "@lovable.dev/mcp-js";

import searchListingsTool from "./tools/search-listings";
import listMyOrdersTool from "./tools/list-my-orders";
import getWalletSummaryTool from "./tools/get-wallet-summary";
import listMyDisputesTool from "./tools/list-my-disputes";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "munjaz-hub",
  title: "Munjaz Hub",
  version: "0.1.0",
  instructions:
    "Tools for the Al-Munjaz (المنجز) digital marketplace. Use `search_listings` to browse published services, " +
    "`list_my_orders` for the signed-in user's escrow orders, `get_wallet_summary` for USDT balance and recent " +
    "transactions, and `list_my_disputes` for dispute cases. All tools act as the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchListingsTool, listMyOrdersTool, getWalletSummaryTool, listMyDisputesTool],
});
