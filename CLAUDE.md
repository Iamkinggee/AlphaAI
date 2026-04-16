# AlphaAI — Project Memory & Architecture

> **Last Updated:** 2026-04-15T13:52:00+01:00

---

## 🎯 Mission

**AlphaAI** is a production-grade crypto signal detection app that catches high-probability trade setups **before price moves**, using Smart Money Concepts (SMC). Built with React Native (Expo) + TypeScript frontend and Node.js backend with a 3-stage detection pipeline.

**Core Philosophy:** Early detection over confirmation. Zero noise.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   FRONTEND (React Native + Expo)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Screens    │  │    Zustand   │  │     Hooks    │         │
│  │  (Expo Router)│◄─┤    Stores    │◄─┤  (useSignals)│         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
│         └──────────────────┴──────────────────┘                 │
│                            │                                     │
│         ┌──────────────────▼──────────────────┐                │
│         │   WebSocket Client  │  REST Client  │                │
│         └──────────────────┬──────────────────┘                │
└────────────────────────────┼──────────────────────────────────┘
                             │
                    ═════════▼═════════
┌─────────────────────────────────────────────────────────────────┐
│                  BACKEND (Node.js + TypeScript)                 │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              3-STAGE DETECTION PIPELINE                    │ │
│  │                                                             │ │
│  │  Stage 1: Structure Scanner (1H/4H/1D candle close)       │ │
│  │  ├─ ZigZag swing detection                                │ │
│  │  ├─ Order Block identification                            │ │
│  │  ├─ Fair Value Gap tracking                               │ │
│  │  ├─ Supply/Demand zone mapping                            │ │
│  │  └─ Liquidity pool detection                              │ │
│  │                     ↓                                       │ │
│  │  Stage 2: Approach Detector (every 60s)                   │ │
│  │  ├─ Price distance check (0.5-1.5% from zones)           │ │
│  │  ├─ Confluence scoring (≥65/100)                          │ │
│  │  ├─ Trade plan computation (Entry/SL/TP1/2/3)            │ │
│  │  └─ "Approaching" alert + push notification              │ │
│  │                     ↓                                       │ │
│  │  Stage 3: Entry Trigger (5M candle close, event-driven)  │ │
│  │  ├─ Confirmation pattern check                            │ │
│  │  ├─ Volume validation                                      │ │
│  │  ├─ Final scoring (≥70/100)                               │ │
│  │  └─ Upgrade to "Active" + confirmation push              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  Express REST API│  │ Binance WebSocket│                    │
│  │  (signals, auth, │  │    Manager       │                    │
│  │   journal, etc.) │  │ (live prices +   │                    │
│  └────────┬─────────┘  │  candle streams) │                    │
│           │             └────────┬─────────┘                    │
└───────────┼──────────────────────┼──────────────────────────────┘
            │                      │
    ════════▼══════════    ════════▼══════════
┌──────────────────────┐  ┌──────────────────┐
│   PostgreSQL         │  │      Redis       │
│   (Supabase)         │  │  (Structural Map)│
│                      │  │                  │
│ • Signals            │  │ • Swing points   │
│ • Users              │  │ • Order Blocks   │
│ • Trade Journal      │  │ • FVGs           │
│ • Notifications      │  │ • S/D Zones      │
│ • Chat History       │  │ • Liquidity Pools│
│ • Watchlist          │  │ (per-pair hash)  │
└──────────────────────┘  └──────────────────┘
```

---

## 📁 Current Project Structure

### Frontend (`/app` + `/src`)

```
AlphaAI/
├── app/                          # Expo Router file-based navigation
│   ├── _layout.tsx               ✅ Root layout (auth gate + theme)
│   ├── (auth)/                   # Auth stack
│   │   ├── _layout.tsx           ✅ Auth group layout
│   │   ├── index.tsx             ✅ Auth entry/redirect
│   │   ├── sign-in.tsx           ✅ Sign-in screen
│   │   ├── sign-up.tsx           ✅ Sign-up screen
│   │   └── forgot-password.tsx   ✅ Password reset
│   ├── (tabs)/                   # Main tab navigator
│   │   ├── _layout.tsx           ✅ Tab layout (custom TabBar)
│   │   ├── index.tsx             ✅ Dashboard (15.6 KB) refactored
│   │   ├── signals.tsx           ✅ Signal feed (12.5 KB) refactored
│   │   ├── chart.tsx             ✅ Chart analysis (6.9 KB)
│   │   ├── journal.tsx           ✅ Trade journal (9.1 KB) refactored
│   │   └── settings.tsx          ✅ Settings (9.8 KB) wired
│   ├── chat.tsx                  ✅ AI Chat modal (12.6 KB)
│   ├── notifications.tsx         ✅ Notifications (5.3 KB)
│   ├── watchlist.tsx             ✅ Watchlist (6.0 KB)
│   └── signal/[id].tsx           ✅ Signal detail (dynamic route)
│
├── src/
│   ├── components/
│   │   ├── ui/                   # Base UI components
│   │   │   ├── AnimatedButton.tsx    ✅ Haptic button
│   │   │   ├── EmptyState.tsx        ✅ Empty states
│   │   │   ├── ErrorBoundary.tsx     ✅ Error boundaries
│   │   │   ├── GradientCard.tsx      ✅ Glassmorphic cards
│   │   │   ├── SkeletonLoader.tsx    ✅ Loading skeletons
│   │   │   ├── StatusBadge.tsx       ✅ Signal status badges
│   │   │   └── TabBar.tsx            ✅ Custom tab bar
│   │   ├── signals/              # Signal-specific components
│   │   │   ├── SignalCard.tsx        ✅ Reusable full signal card
│   │   │   ├── ApproachingCard.tsx   ✅ Approaching panel card
│   │   │   ├── ConfluenceBreakdown.tsx ✅ Score breakdown
│   │   │   ├── TradePlan.tsx         ✅ Entry/SL/TP display
│   │   │   └── TradeCard.tsx         ✅ Journal trade card
│   │   └── charts/               # Chart components (planned)
│   │       ├── CandlestickChart.tsx  📋 Skia-based chart (Phase 4)
│   │       ├── ZoneOverlay.tsx       📋 OB/FVG/S&D overlays (Phase 4)
│   │       ├── SwingLabels.tsx       📋 HH/HL/LH/LL labels
│   │       ├── LiquidityLines.tsx    📋 Liquidity pool lines
│   │       └── SparklineChart.tsx    ✅ Mini sparklines (View-based)
│   │
│   ├── constants/
│   │   ├── colors.ts             ✅ Color system (#090E1A, #00F0A0, etc.)
│   │   ├── fonts.ts              ✅ DM Sans + JetBrains Mono
│   │   ├── spacing.ts            ✅ 4px-based spacing scale
│   │   ├── scoring.ts            ✅ Confluence weights table
│   │   ├── api.ts                ✅ API endpoints
│   │   └── index.ts              ✅ Barrel export
│   │
│   ├── hooks/                    # Custom hooks ✅ ALL COMPLETE
│   │   ├── useAuth.ts            ✅ Auth operations + settings
│   │   ├── useSignals.ts         ✅ Signal fetching + filters
│   │   ├── useMarket.ts          ✅ Live price subscription
│   │   ├── useWatchlist.ts       ✅ Watchlist operations
│   │   ├── useNotifications.ts   ✅ Notification handling
│   │   ├── useJournal.ts         ✅ Trade journal ops
│   │   └── index.ts              ✅ Barrel export
│   │
│   ├── store/                    # Zustand stores ✅ ALL COMPLETE
│   │   ├── useAuthStore.ts       ✅ User + SecureStore JWT state
│   │   ├── useSignalStore.ts     ✅ Signals (approaching/active/history + filters)
│   │   ├── useMarketStore.ts     ✅ Live price cache + market pulse
│   │   ├── useWatchlistStore.ts  ✅ Watchlist + AsyncStorage persist
│   │   ├── useNotificationStore.ts ✅ Priority notifications + unread count
│   │   ├── useJournalStore.ts    ✅ Trade journal + stats engine + AsyncStorage
│   │   ├── useChatStore.ts       ✅ AI chat + optimistic streaming
│   │   └── index.ts              ✅ Barrel export
│   │
│   ├── services/                 # External service integrations ✅ COMPLETE
│   │   ├── apiClient.ts          ✅ Typed fetch wrapper + auth headers
│   │   └── wsManager.ts          ✅ Auto-reconnecting WS singleton + typed events
│   │
│   ├── data/
│   │   └── mockSignals.ts        ✅ 6 rich mock signals (all statuses)
│   │
│   ├── types/                    # Shared TypeScript types ✅ COMPLETE
│   │   ├── signal.ts             ✅ SignalStatus, Signal, ConfluenceFactor, TakeProfit
│   │   ├── market.ts             ✅ MarketPulse, PriceTick, CandleData
│   │   ├── journal.ts            ✅ Trade, JournalStats, TradeResult
│   │   ├── auth.ts               ✅ User, AuthStatus, UserSettings, NotificationPreferences
│   │   └── index.ts              ✅ Barrel export
│   │
│   └── utils/                    # Utility functions
│       └── formatters.ts         ✅ Price/date/percentage formatters
│
├── app.config.ts                 ✅ Expo dynamic config
├── eas.json                      ✅ EAS Build profiles
├── .env.example                  ✅ Environment variables
├── tsconfig.json                 ✅ TypeScript config (strict + aliases)
└── package.json                  ✅ Dependencies

Legend:
  ✅ Completed
  🔨 Active (in progress)
  📋 Planned (not yet started)
```

### Backend (`/backend` — planned structure)

```
backend/
├── src/
│   ├── index.ts                  📋 Express server entry
│   ├── config.ts                 📋 Environment config + validation
│   │
│   ├── workers/                  # 3-Stage Detection Pipeline
│   │   ├── structureScanner.ts   📋 Stage 1: Swing/OB/FVG/S&D detection
│   │   ├── approachDetector.ts   📋 Stage 2: Price proximity + approaching alerts
│   │   ├── entryTrigger.ts       📋 Stage 3: 5M confirmation + active upgrade
│   │   └── signalLifecycle.ts    📋 TP/SL monitoring + invalidation
│   │
│   ├── services/
│   │   ├── structureEngine/      # SMC Analysis Engine
│   │   │   ├── swingDetector.ts      📋 ZigZag + swing labeling
│   │   │   ├── bosChoch.ts           📋 BOS/CHOCH detection
│   │   │   ├── orderBlocks.ts        📋 Bullish/Bearish OB detection
│   │   │   ├── fairValueGaps.ts      📋 FVG detection + fill tracking
│   │   │   ├── supplyDemand.ts       📋 S&D zone identification
│   │   │   ├── liquidityPools.ts     📋 Equal highs/lows + sweeps
│   │   │   ├── premiumDiscount.ts    📋 50% equilibrium model
│   │   │   └── structureBuilder.ts   📋 Orchestrator (writes to Redis)
│   │   │
│   │   ├── marketData/
│   │   │   ├── binanceWS.ts          📋 Auto-reconnecting WS manager
│   │   │   ├── binanceREST.ts        📋 Historical candle fetcher
│   │   │   ├── coinGecko.ts          📋 Market pulse data
│   │   │   └── pairUniverse.ts       📋 Top 80 USDT pairs
│   │   │
│   │   ├── signalScorer.ts       📋 Confluence scoring (0-100)
│   │   ├── tradePlanner.ts       📋 Entry/SL/TP computation
│   │   ├── notificationService.ts 📋 Expo Push + FCM delivery
│   │   └── aiService.ts          📋 GPT-4o context assembly + API
│   │
│   ├── routes/                   # REST API Endpoints
│   │   ├── auth.ts               📋 Sign up/in, token refresh
│   │   ├── signals.ts            📋 GET signals (approaching/active/history)
│   │   ├── journal.ts            📋 Trade journal CRUD
│   │   ├── watchlist.ts          📋 Watchlist + price alerts
│   │   ├── notifications.ts      📋 Notification history + settings
│   │   ├── chat.ts               📋 AI chat sessions
│   │   ├── market.ts             📋 Market pulse + pairs + candles
│   │   └── analysis.ts           📋 On-demand analysis + structure
│   │
│   └── cache/                    # Redis Layer
│       ├── redisClient.ts        📋 Redis connection
│       └── structuralMap.ts      📋 Read/write helpers (per-pair hash)
│
├── supabase/
│   └── migrations/               # PostgreSQL Schema
│       ├── 001_users.sql         📋 Users table + RLS
│       ├── 002_signals.sql       📋 Signals table + RLS
│       ├── 003_journal.sql       📋 Trade journal + RLS
│       ├── 004_notifications.sql 📋 Notification log + RLS
│       ├── 005_chat.sql          📋 Chat sessions/messages + RLS
│       └── 006_watchlist.sql     📋 Watchlist + alerts + RLS
│
├── package.json                  📋 Backend dependencies
└── tsconfig.json                 📋 Backend TypeScript config
```

---

## 🎨 Design System

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `background` | `#090E1A` | App background |
| `card` | `#0F1923` | Card surfaces |
| `cardSecondary` | `#141E2E` | Secondary cards |
| `border` | `#1A2332` | Card borders |
| `bullish` | `#00F0A0` | Long/positive signals |
| `bearish` | `#FF3366` | Short/SL markers |
| `approaching` | `#FFB800` | Pending/near-trigger |
| `accentPrimary` (info) | `#00D4FF` | Interactive, tab active |
| `accentSecondary` | `#6C63FF` | Gradient pairs, OB zones |
| `textPrimary` | `#FFFFFF` | Headings |
| `textSecondary` | `#A0AEC0` | Body text |
| `textTertiary` | `#64748B` | Muted text |

### Typography

- **UI Text** (labels, body, headings): `DM Sans` — Regular/Medium/SemiBold/Bold
- **Data** (prices, scores, RR, figures): `JetBrains Mono` — Regular/Medium/SemiBold/Bold

### Spacing Scale (4px base)

```typescript
xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 20px, 
xxl: 24px, xxxl: 32px, xxxxl: 40px
```

---

## 🔑 Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Navigation** | Expo Router v6 (file-based) | Zero-config deep links, typed routes, modern standard |
| **State Management** | Zustand v5 | Minimal boilerplate, React 19 compatible, no Redux overhead |
| **Animations** | React Native Reanimated v4 | 60fps worklet-based UI thread animations |
| **Charts** | `@shopify/react-native-skia` | Pixel-perfect canvas rendering for exact price-level zone overlays |
| **Auth Storage** | Expo SecureStore | OS-level Keychain/Keystore encryption (never AsyncStorage for JWT) |
| **Backend Database** | PostgreSQL (Supabase) | Signals, users, journal, notifications, chat history (with RLS) |
| **Backend Cache** | Redis (ioredis) | Real-time structural map state (swing points, OBs, FVGs, zones) per pair |
| **WebSocket** | Binance WS + custom manager | Live price feeds (Stage 2) + 5M candle streams (Stage 3) |
| **Push Notifications** | Expo Push API + FCM | Critical: approach alerts, entry confirmations, TP/SL hits |
| **AI** | OpenAI GPT-4o | Trading analyst with full market context injection |
| **Build** | EAS Build | iOS + Android profiles (dev/preview/production) |

---

## 📦 Key Dependencies

### Frontend

| Package | Version | Purpose |
|---|---|---|
| `expo` | ~54.0.33 | Core SDK |
| `expo-router` | ~6.0.23 | File-based navigation |
| `react-native-reanimated` | ~4.1.1 | Animations |
| `react-native-gesture-handler` | ~2.28.0 | Touch gestures |
| `expo-linear-gradient` | ~15.0.8 | Gradient cards/backgrounds |
| `expo-blur` | ~15.0.8 | Blur effects |
| `expo-haptics` | ~15.0.8 | Tactile feedback |
| `expo-secure-store` | ~15.0.8 | JWT storage (encrypted) |
| `expo-notifications` | ~15.0.8 | Push notifications |
| `@react-native-async-storage/async-storage` | 2.2.0 | Local data (non-sensitive) |
| `zustand` | ^5.0.12 | Global state management |
| `@shopify/react-native-skia` | latest | Canvas-based charts |

### Backend (Planned)

| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.18 | REST API server |
| `typescript` | ^5.x | Type safety |
| `ioredis` | ^7.x | Redis client (structural maps) |
| `@supabase/supabase-js` | ^2.x | PostgreSQL client (signals, users, etc.) |
| `ws` | latest | WebSocket server |
| `openai` | latest | GPT-4o API client |
| `node-fetch` | latest | Binance REST API |

---

## 🚧 Development Status

### ✅ Phase 1: UI/UX Architecture (COMPLETE)

- [x] Expo Router navigation (auth stack + tab stack + modals + dynamic routes)
- [x] Design system constants (colors, fonts, spacing, scoring weights)
- [x] 7 base UI components (AnimatedButton, EmptyState, ErrorBoundary, GradientCard, SkeletonLoader, StatusBadge, TabBar)
- [x] All 9 screens (auth flow, 5 tabs, chat, notifications, watchlist, signal detail)
- [x] TypeScript strict — **0 errors**

---

- [x] `backend/` directory, `package.json`, `tsconfig.json`
- [x] `src/index.ts` (Express server + health check)
- [x] `src/config.ts` (Zod env validation)
- [x] `backend/.env.example`
- [x] `supabase/migrations/001_users.sql`, `002_signals.sql`, `003_journal.sql`
- [x] Directory scaffold: `workers/`, `services/structureEngine/`, `routes/`, `cache/`

**Services** (building now):
- [/] `src/cache/redisClient.ts` — Redis connection singleton
- [ ] `src/services/supabaseClient.ts` — Supabase client wrapper
- [ ] `src/routes/signals.ts` — GET /signals
- [ ] `src/routes/auth.ts` — POST /auth/sign-in, sign-up
- [ ] `src/routes/journal.ts` — CRUD /journal
- [ ] `src/routes/market.ts` — GET /market/pulse

---

### 📋 Phase 3: Signal Engine (Not Started)

**3-Stage Detection Pipeline:**
- [ ] **Stage 1: Structure Scanner** — Swing detection, OB/FVG/S&D/liquidity identification (7 files)
- [ ] **Stage 2: Approach Detector** — Price proximity check, confluence scoring, approaching alerts
- [ ] **Stage 3: Entry Trigger** — 5M confirmation, volume validation, active upgrade

**Supporting Services:**
- [ ] Signal scorer (confluence 0-100)
- [ ] Trade planner (Entry/SL/TP computation)
- [ ] Notification service (Expo Push + FCM)
- [ ] AI service (GPT-4o context assembly)

---

### 📋 Phases 4-8 (Not Started)

- Phase 4: REST API endpoints (8 route files)
- Phase 5: Frontend-backend integration (stores + hooks + API client)
- Phase 6: Real-time features (WebSocket integration, live price updates, push notifications)
- Phase 7: AI Chat implementation (frontend + backend)
- Phase 8: Polish, testing, EAS build config, documentation

---

## 🔨 Currently Active Files

| File | Status | Location | Notes |
|---|---|---|---|
| `app/(tabs)/journal.tsx` | 🔨 **ACTIVE** | Line 20 | Trade journal — final UI review |
| `app/(tabs)/settings.tsx` | 👁️ Open | — | User settings screen |
| `src/components/ui/EmptyState.tsx` | 👁️ Open | — | Empty state component |
| `app.config.ts` | 👁️ Open | — | Expo config |
| `.env.example` | 👁️ Open | — | Environment variables |
| `src/constants/fonts.ts` | 👁️ Open | — | Font definitions |

---

## 🌿 Dev Commands

```bash
# Start dev server
npm start

# Run on platforms
npm run android
npm run ios
npm run web

# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Build (EAS)
eas build --profile development
eas build --profile preview
eas build --profile production
```

---

## 📝 Dev Log

| Timestamp | Event |
|---|---|
| 2026-04-15T12:33:00 | Phase 3.5 Custom Hooks complete — 0 TypeScript errors. All screens use hooks. |
| 2026-04-15T12:00:00 | Phase 3 components refactored into all screens + Sparklines + formatters complete |
| 2026-04-15T11:45:00 | Phase 2 complete. Building Phase 3 signal components + formatters |
| 2026-04-15T11:40:00 | Phase 2 complete — 0 TypeScript errors. All stores wired to all screens. |
| 2026-04-15T10:40:00 | Fixed StatusBadge type mismatch + auth/index route — tsc clean |
| 2026-04-15T10:09:00 | All 7 Zustand stores + apiClient + wsManager created |
| 2026-04-15T10:03:00 | Types (signal, market, journal, auth) + mockSignals created |
| 2026-04-15T09:29:00 | Phase 1 UI/UX complete |

---

## 🎯 Next Immediate Actions

1. ✅ ~~Phase 1 UI~~ — Complete
2. ✅ ~~Zustand Stores + API Client~~ — Complete  
3. ✅ ~~Signal Components + Formatters~~ — Complete
4. ✅ ~~Custom Hooks Layer (Phase 3.5)~~ — Complete, 0 TS errors
5. 🔨 **Backend Services** — Redis client, Supabase client, REST routes
6. 📋 **3-Stage Detection Pipeline** — Structure Scanner, Approach Detector, Entry Trigger

---

*This file is the single source of truth for AlphaAI context. Update after every meaningful change.*