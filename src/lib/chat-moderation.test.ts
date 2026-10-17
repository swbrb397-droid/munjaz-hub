// @ts-nocheck -- run with `bun test`
import { describe, expect, it } from "bun:test";
import { moderateChatText } from "./chat-moderation";

describe("moderateChatText", () => {
  it("does not block normal Arabic words", () => expect(moderateChatText("منتجات رقمية للزبون").blocked).toBe(false));
  it("blocks insults", () => expect(moderateChatText("يا كلب").blocked).toBe(true));
  it("blocks spaced phone numbers", () => expect(moderateChatText("0 5 9 9 7 7 1 2 3").blocked).toBe(true));
  it("blocks WhatsApp mentions", () => expect(moderateChatText("راسلني واتساب").blocked).toBe(true));
});
