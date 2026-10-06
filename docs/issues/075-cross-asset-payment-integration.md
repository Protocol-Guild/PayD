# #075: Cross-Asset Payment UI Integration

**Category:** [FRONTEND]
**Difficulty:** ● HARD
**Tags:** `cross-asset`, `soroban`, `stellar`, `pathfind`, `ui`

## Description

Wire the existing `CrossAssetPayment.tsx` page fully to the backend and the `cross_asset_payment` contract. The page should perform real Stellar path-finding via the backend proxy, display available conversion paths, preview settlement amounts, and submit the final cross-asset payment through a signed Soroban contract invocation.

## Acceptance Criteria

- [ ] Path-finding request sent to backend on asset/amount change with debounce.
- [ ] Available conversion paths rendered as selectable options with rates.
- [ ] Settlement preview shows fee, slippage, and expected delivery amount.
- [ ] Submit triggers simulation then wallet-signed submission to the contract.
- [ ] Page shows live status updates after submission via the `SocketProvider`.

## Settlement status display follow-through

The page's matching `confirmed` and `success` socket events set its local status
to `success`. The status badge and progress indicators now recognize that value
alongside the existing `completed` and `confirmed` display values. Completed
settlement is no longer faded. Pending submission keeps its initiation spinner
and faded settlement row.

This correction changes presentation only. The existing quote lifecycle,
transaction-hash filtering, subscriptions, notifications, contract service and
submission service are unchanged.

### Native observation, 3 October 2026

The unchanged page at `c7c8f1f058ac79d7f544373dace5de3822d253fb` was mounted with
its actual hooks, quote service and contract registry service. A real Socket.IO
4.8.3 client and local server delivered both event names. Wallet and notification
contexts were controlled; an explicit local submission adapter returned local
transaction hashes without signing or invoking an RPC provider.

The same sequence covered nine states and 33 acceptance observations before and
after the correction. The original page passed 25 controls and failed eight
display observations: each terminal event left a blue badge, muted initiation
and settlement indicators, and settlement opacity of 0.5. The corrected page
passes all 33; both terminal events produce the success colors and opacity 1.
Desktop (1280 px) and phone (390 px) status captures were inspected.

Controls retain the pending spinner, matching nonterminal status text, refusal
of unrelated/malformed updates, old-transaction filtering after another
submission, quote invalidation, and subscription cleanup on replacement and
unmount. Both phases made the same ten local HTTP requests and exchanged the
same six server events and four subscription messages. Notifications and zero
signer calls also match. Both phases had zero page or console errors.

The 14-file application/style import closure matched the pinned source before
the correction. Its actual global stylesheet and scoped utilities were compiled
with Tailwind 4.2.0 from cache bytes verified against the frontend lockfile's
integrity. Compiled stylesheet bytes are identical before and after. The remote
font stylesheet was fulfilled locally with empty CSS, using fallback fonts.

The page import graph also passes TypeScript 5.9.3 with the existing
`frontend/tsconfig.app.json` options and only the page/environment include scope
narrowed. Native rendering used Node 24.19.0, Chromium 153.0.8010.0, React/DOM
19.2.7, Axios 1.13.6, Lucide 0.400.0 and esbuild 0.27.3. Retained Stellar SDK
12.3.0 differs from declared 14.3.3; the signing implementation was not exercised.
Vite 7.3.1 client declarations came from verified root-lock cache bytes, while
the frontend lock remains at 7.2.6. No dependency declaration or lockfile changed.

This is page and local transport evidence. Full application routing/providers,
the complete configured build or E2E suite, deployed authentication, real wallet
signing, chain settlement, Docker and Kubernetes were not exercised. The broader
acceptance criteria above remain pending their respective integration evidence.
