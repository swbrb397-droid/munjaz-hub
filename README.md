# Munjaz Hub

# MASTER PROMPT: Full-Stack Digital Marketplace Platform - "Munjaz" (مُنجَز)



## 1. Executive Summary & Tech Stack

Build a modern, full-stack, responsive, and bilingual (Arabic & English with RTL/LTR support) Web3-friendly digital marketplace platform named **"Munjaz" (مُنجَز)**.

- **Frontend Stack:** Next.js (App Router), React, Tailwind CSS, Lucide React Icons, Framer Motion.

- **Backend & Database:** Supabase/Convex integration for Auth, Real-time Database, and Storage.

- **Design System:** Modern Adaptive UI with Light/Dark mode. Futuristic/Cyberpunk vibe for Gaming & NFT sections, clean Minimalist Enterprise UI for freelance and corporate sections.



---



## 2. Core Platform Ecosystem & Features



### A. Core Marketplace Modules

1. **Freelance Services & Projects (Escrow System):** Milestone-based order flow with funds locked in the internal wallet until buyer approval or AI dispute resolution.

2. **Instant Digital Goods & LMS Courses:** Direct file downloads and built-in secure video player for courses (non-refundable unless technical flaw is verified).

3. **Gaming & Coaching Hub:** Interactive booking system for gaming sessions.

4. **Professional NFT Menu:** Dedicated gallery and listing showcase for digital assets and NFTs.



### B. Internal USDT Wallet & Crypto Financial System

- **Currency:** Exclusively **USDT** with real-time conversion tooltips showing local estimated values (e.g., USD, SAR, AED, EUR).

- **Networks Supported:** TRC-20, BEP-20, Polygon.

- **Internal Wallet Architecture:** Zero gas fees for internal transactions between users.

- **Withdrawal Engine:**

  - **Instant Payouts:** Available for Verified (KYC) sellers with a small micro-fee.

  - **Scheduled Payouts:** Time-locked withdrawals for new unverified accounts for platform treasury safety.



### C. Tiered Identity Verification (KYC) & Trust System

- **Tier 1 (Basic):** Limited daily volume without heavy documentation.

- **Tier 2 (Verified):** KYC document upload system to unlock the **"Verified Badge"** (شارة الثقة) and Instant Withdrawals.



### D. AI Engine Integration (Gemini / OpenAI API Hooks)

1. **AI Dispute Resolution Agent:** Evaluates Scope of Work (SOW), order chats, and delivery files to issue instant fair rulings during buyer-seller disputes.

2. **AI Anti-Review Blackmail System:** Monitors chat logs proactively for threats or rating manipulation. Allows sellers to lodge formal review appeals with automated verification.

3. **Real-Time Dynamic AI Chat Translator:** Seamless translation between Arabic and English inside workspace messages.



### E. Advanced Real-Time Workspace & Communication

- Live chat with embedded file sharing and AI translation toggle.

- Built-in WebRTC Voice & Video Call component (Daily.co / Agora integration mockup).

- Security filter preventing external contact leak attempts.



### F. Affiliate Marketing & Gamification (XP System)

- **Hybrid Referral Program:** Generates tracking links giving affiliates a **15-20% share of net platform commission** for **12 months** per referred user.

- **Gamification (XP & Levels):** XP progress bar, achievement badges, and level ranks for top sellers and buyers.



### G. Notification & Alert Hub

- In-App Toast & Bell Notifications.

- Telegram Bot Integration mockup for real-time trade alerts on mobile.



---



## 3. UI/UX Page Structure Required

Create the following interactive pages and components:

1. **Landing Page:** Hero section, dynamic currency ticker, featured services, digital products grid, NFT showcase, and affiliate calculator.

2. **Interactive User Dashboard:** Dual view (Buyer / Seller) with live income stats, active orders, XP progress, and crypto wallet metrics.

3. **Internal Wallet Page:** Deposit modal (TRC20/BEP20/Polygon QR codes), Withdrawal request form, and transaction ledger.

4. **Order Workspace Page:** Real-time chat, video call launcher, file deliverable tab, AI translation button, and dispute creation trigger.

5. **NFT & Digital Storefront:** Filtering grid for digital assets, courses, and NFTs.

6. **Admin Control Panel:** Dispute management queue, user verification center, and revenue analytics dashboard.



---



## 4. UI/UX Expectations

- Clean, accessible, scannable layout with crisp typography (Cairo / Inter font family).

- Fully responsive across mobile, tablet, and desktop screens.

- Zero boilerplate errors, properly typed React state management, and clear UI components.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/90dfc046-afed-4bc0-bf51-d7528dd1ca61).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
