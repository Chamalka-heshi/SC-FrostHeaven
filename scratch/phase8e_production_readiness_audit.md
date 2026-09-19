# SC Frost Heaven — Phase 8E Production Deployment Readiness Audit Report

**Date:** 2026-09-19  
**Repository:** `Chamalka-heshi/SC-FrostHeaven`  
**Current Branch:** `main`  
**Latest Checkpoint Commit:** `5749620` (`feat: implement SEO and discoverability`)  
**Audit Mode:** Read-Only Discovery & Production Readiness Verification  

---

## 1. Executive Summary

A comprehensive production readiness audit was performed across the SC Frost Heaven web application, database architecture, third-party integrations, authentication configuration, and hosting requirements.

### Key Audit Conclusions:
- **Application Code & Build Quality:** **READY**. TypeScript typecheck (`bunx tsc --noEmit`) passes with zero errors, the production build (`bun run build`) compiles cleanly via Vite + Nitro, and zero development/localhost URLs exist in production runtime code.
- **Database & RLS Security:** **READY**. All 9 database migrations are synchronized between local and remote. RLS policies strictly protect customer tables, financial fields, and internal kitchen notes. The Phase 8C secure RPC (`get_my_custom_orders()`) is operational and the vulnerable `customer_custom_orders` view remains completely removed.
- **Transactional Email (Resend):** **BLOCKER (NEEDS MANUAL CONFIGURATION)**. The automated database webhook (`pg_net`) and Edge Function (`send-transactional-email`) logic are fully implemented and tested. However, emails cannot currently be delivered via Resend because sending with `From: ...@gmail.com` is rejected (HTTP 403) by Resend due to unverified domain ownership. A verified custom domain From address (e.g. `orders@<custom-domain>`) must be configured in Resend and set via `RESEND_FROM_EMAIL` in Supabase Edge Function secrets.
- **Domain & Hosting Provider:** **NEEDS MANUAL CONFIGURATION**. Hosting provider is not yet established in repository configuration (no Cloudflare/Vercel/Netlify CI pipeline attached). Canonical URL currently defaults to `https://scfrostheaven.com`.
- **Shopify Storefront Integration:** **READY**. Connects to `sweet-creations-hub-3tcl4-emuk4ghy.myshopify.com` using the public Storefront API access token with local cart fallback for Supabase menu items.

---

## 2. Current Repository State

- **Branch:** `main` (clean working tree, up to date with `origin/main`).
- **Latest Commit:** `5749620` — `feat: implement SEO and discoverability`.
- **Package Manager:** `bun` (engine: Bun / Node ES2022).
- **TypeScript:** `5.8.3` (Strict mode enabled, `noEmit: true`, path alias `@/* -> ./src/*`).
- **Framework:** `@tanstack/react-start` `1.168.32` + `@tanstack/react-router` `1.170.18` + `@tanstack/react-query` `5.101.1` + `nitro` `3.0.260603-beta`.
- **UI / Styling:** `Tailwind CSS v4` + `Radix UI` primitives + `Sonner` toasts + `Lucide React` icons.
- **Static Assets:** Favicon (`public/favicon.png`), logo (`public/logo.png`), manifest (`public/site.webmanifest`), sitemap (`public/sitemap.xml`), and robots (`public/robots.txt`).

### Global Codebase Pattern Search Results:
| Search Term | Findings | Classification | Notes |
| :--- | :--- | :--- | :--- |
| `localhost` | 0 occurrences | **READY** | No hardcoded local URLs in production runtime |
| `127.0.0.1` | 0 occurrences | **READY** | No hardcoded loopback IPs |
| `0.0.0.0` | 0 occurrences | **READY** | No hardcoded wildcard IPs |
| `VITE_` | Referenced in `.env.example`, `supabase.ts`, `seo.ts`, `send-transactional-email` | **EXPECTED** | Standard Vite client-side environment variable prefix |
| `SUPABASE` | Referenced in `src/lib/supabase.ts`, migrations, `config.toml` | **EXPECTED** | Public URL and anon publishable JWT |
| `SHOPIFY` | Referenced in `src/lib/shopify.ts`, `cart.ts`, `fulfillment.ts` | **EXPECTED** | Storefront API domain & public token |
| `RESEND` | Referenced in `send-transactional-email` Edge Function | **PRODUCTION-REQUIRED** | `RESEND_API_KEY` & `RESEND_FROM_EMAIL` (server-side only) |
| `API_KEY` / `SECRET` | Referenced in Vault migrations & Edge Function | **EXPECTED** | Stored securely in Supabase Vault & Edge Function secrets |

---

## 3. Environment Variable Inventory

| Variable Name | Referenced In | Environment | Type | Secret? | Local Present? | Production Purpose | Required In Hosting? | Required In Supabase? |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :---: | :---: |
| `VITE_SUPABASE_URL` | `src/lib/supabase.ts` | Client / SSR | Optional (has fallback) | No | Fallback (`https://xaqczelrmlhjhfjxlwzv.supabase.co`) | Connect frontend to Supabase REST / Auth / Storage | Optional (Recommended) | No |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `src/lib/supabase.ts` | Client / SSR | Optional (has fallback) | No (Public Anon JWT) | Fallback (`eyJhbGci...`) | Public client-side queries subject to RLS | Optional (Recommended) | No |
| `VITE_SITE_URL` | `src/lib/seo.ts`, Edge Function | Client / SSR / Deno | Optional (has fallback) | No | Fallback (`https://scfrostheaven.com`) | Canonical URL generation, OpenGraph tags, sitemap, email links | Yes (set to live domain) | Yes (as `SITE_URL`) |
| `RESEND_API_KEY` | `send-transactional-email` | Deno Edge Function | Required for live email | **YES** | Configured in Supabase Secrets | Authenticates outgoing requests to Resend API | No | **YES (Edge Function Secret)** |
| `RESEND_FROM_EMAIL` | `send-transactional-email` | Deno Edge Function | Required for custom domain | No | Defaults to `scfrostheaven@gmail.com` | Verified sender address (e.g. `orders@<verified-domain>`) | No | **YES (Edge Function Secret)** |
| `WEBHOOK_SECRET` | `send-transactional-email` | Deno Edge Function | Required | **YES** | Provisioned | Validates incoming `apikey` header from pg_net trigger | No | **YES (Edge Function Secret)** |
| `scfrostheaven_transactional_email_webhook_key` | PostgreSQL Trigger | Database Vault | Required | **YES** | Provisioned in Vault | Transmits authentication key to Edge Function via pg_net | No | **YES (Supabase Vault)** |

---

## 4. Supabase Production Readiness

### Database Migrations Status:
All 9 migrations are **100% synchronized** between repository code and the live remote database:
1. `20260905000000_create_notifications.sql`
2. `20260906000001_phase5c_polish_and_notes.sql`
3. `20260906000002_phase5c_secure_internal_notes.sql`
4. `20260907000000_phase6b_structured_payments.sql`
5. `20260908000000_phase7b_kitchen_scheduling.sql`
6. `20260914000000_phase8b_pg_net_transactional_email_trigger.sql`
7. `20260916000000_phase8c_secure_customer_order_rpc.sql`
8. `20260916000001_phase9a_menu_items_and_storage.sql`
9. `20260916000002_fix_vanilla_cake_image_url.sql`

### Security Definer & RLS Audit:
- **`public.customer_custom_orders` View:** **REMOVED**. Confirmed that this security-definer view does not exist in schema cache.
- **`public.get_my_custom_orders()` RPC:** **ACTIVE & STABLE**. Confirmed that authenticated customers query only their own orders with strict column filtering (excluding internal kitchen notes, admin notes, payment references, and staff assignments). Unauthenticated/anon requests safely return empty arrays (`[]`).
- **Base Table RLS:** `public.custom_orders` has direct `SELECT` restricted to `profiles.role = 'admin'`. Public users can only `INSERT` (for guest/customer request creation) and mutate via secure RPCs (`accept_custom_order_quote`, `cancel_custom_order_quote`).
- **Database Triggers:** `handle_notification_transactional_email()` trigger is attached to `AFTER INSERT ON public.notifications`.

---

## 5. Supabase Auth Production Configuration

### Current Frontend Auth Routes:
- `/login` — `createNoIndexMeta("Login")`
- `/register` — `createNoIndexMeta("Register")`
- `/forgot-password` — `createNoIndexMeta("Forgot Password")`, sends reset email with `redirectTo = ${window.location.origin}/reset-password`
- `/reset-password` — `createNoIndexMeta("Reset Password")`, executes `supabase.auth.updateUser({ password })`
- `/auth/callback` — `createNoIndexMeta("Authentication")`, handles hash tokens and session exchange
- `/account` — `createNoIndexMeta("My Account")`, protected customer portal

### Manual Configuration Required in Supabase Dashboard (Auth > URL Configuration):
1. **Site URL:** Set to the actual production domain (e.g. `https://scfrostheaven.com` or custom production URL).
2. **Redirect URLs (Allow list):**
   - `https://<production-domain>/`
   - `https://<production-domain>/**`
   - `https://<production-domain>/reset-password`
   - `https://<production-domain>/auth/callback`
   - `https://<production-domain>/account`
3. **Email Templates (Auth):** Ensure the password reset and email confirmation templates point to the production domain.

---

## 6. Supabase Storage Readiness

| Bucket ID | Status | Public? | Size Limit | Allowed MIME Types | Policies |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `cake-references` | **READY** | Private (`false`) | 5 MB | `image/*` | Anyone can upload (`INSERT`) for order creation; Read (`SELECT`) restricted to signed URLs (`createSignedUrl(path, 3600)`) |
| `menu-images` | **READY** | Public (`true`) | 10 MB | `jpeg, png, webp, gif` | Public can view (`SELECT`); Upload / Update / Delete restricted to `profiles.role = 'admin'` |

---

## 7. Shopify Production Readiness

- **Shopify Store Domain:** `sweet-creations-hub-3tcl4-emuk4ghy.myshopify.com`
- **Storefront API Version:** `2025-07`
- **Storefront API Token:** `b3f180187721fc20ed15511e802c3395` (Public Storefront API client token).
- **Checkout Flow:**
  - If cart contains exclusively Shopify items: Redirects to Shopify hosted checkout URL (`cart.checkoutUrl`).
  - If cart contains Supabase menu items: Handled via bakery direct order / inquiry workflow.
- **Product handles:** 3 Shopify products (`chocolate-indulgence`, `fresh-fruit-delight`, `fruit-fusion`) + 6 Supabase catalog items.

---

## 8. Resend & Transactional Email (CRITICAL AUDIT)

### Status: **BLOCKER (NEEDS MANUAL CONFIGURATION)**

### Current Behavior & Blocker Analysis:
1. **Pipeline Implementation:** Complete. When an admin updates order status to any of the 7 milestone types (`quote_ready`, `order_confirmed`, `in_baking`, `order_ready`, `order_completed`, `order_declined`, `order_cancelled`), a record is inserted into `public.notifications`.
2. **pg_net Webhook Trigger:** Fires an asynchronous HTTP POST with the secret from Vault to the `send-transactional-email` Edge Function.
3. **Resend Rejection Reason:**
   - In Resend, outgoing emails MUST be sent from a domain verified by DNS records (DKIM, SPF).
   - Sending from `scfrostheaven@gmail.com` directly is rejected with **HTTP 403 Forbidden** by Resend because `@gmail.com` cannot be verified by third parties.
4. **Required Resolution:**
   - The business contact & `Reply-To` address **MUST remain** `scfrostheaven@gmail.com`.
   - The `From` address in Resend must be a custom domain (e.g. `SC Frost Heaven <orders@scfrostheaven.com>` or `SC Frost Heaven <notifications@scfrostheaven.com>`).
   - The custom domain must be added and verified in the Resend Dashboard with DNS records (MX, SPF/TXT, DKIM/CNAME).
   - Once verified, the Supabase Edge Function secret `RESEND_FROM_EMAIL` must be set:
     ```bash
     bunx supabase secrets set RESEND_FROM_EMAIL="SC Frost Heaven <orders@scfrostheaven.com>"
     ```

---

## 9. Domain & DNS Readiness

### Current Assumptions:
- Canonical base URL fallback in `src/lib/seo.ts` is `https://scfrostheaven.com`.
- Public assets (`robots.txt`, `sitemap.xml`, `site.webmanifest`) reference `https://scfrostheaven.com`.

### Production Setup Requirements:
1. When the official production domain is registered:
   - Point DNS A/CNAME records to the hosting provider.
   - Configure SSL/TLS certificate (Automatic on Cloudflare / Vercel / Netlify).
   - Set environment variable `VITE_SITE_URL=https://<your-domain>` in hosting environment settings.

---

## 10. Hosting & Deployment Provider

### Current Status: **Hosting provider not yet established.**

- The project uses `@lovable.dev/vite-tanstack-config` with `nitro` server building for a `cloudflare-module` preset.
- The build outputs:
  - Client static assets: `.output/public/`
  - Server worker: `.output/server/index.mjs` (Wrangler compatibility ready)
- **Deployment options available:**
  - **Cloudflare Pages / Workers:** Direct match for the generated `.output/` directory and `wrangler.json`.
  - **Vercel / Netlify / Node Server:** Compatible with minor Nitro preset adjustments in `vite.config.ts` if desired.

---

## 11. Security Headers

Recommended security headers to configure at the CDN / edge hosting level:
```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```
*Note: Ensure CSP whitelists `https://*.supabase.co`, `wss://*.supabase.co`, and `https://*.myshopify.com`.*

---

## 12. SEO Production Configuration

- **`public/robots.txt`:** Allows all 7 public routes, explicitly disallows `/admin/`, `/account`, `/login`, `/register`, `/auth/`, and references `https://scfrostheaven.com/sitemap.xml`.
- **`public/sitemap.xml`:** XML 0.9 standard containing all 6 static routes and 9 active catalog products (6 Supabase + 3 Shopify).
- **`public/site.webmanifest`:** Configured with standalone mode, `#FFF5F5` theme color, and `#FFFFFF` background.
- **Structured Data:** Verified `Bakery` (`#bakery`), `WebSite` (`#website`), `Product`, and `BreadcrumbList` schemas across public pages.

---

## 13. Data & Database Safety Audit

- **Customer Isolation:** Customers can only retrieve their own orders via `get_my_custom_orders()`.
- **Data Protection:** Private kitchen commentary (`internal_notes`), payment references, and staff assignments are excluded from all customer endpoints and emails.
- **Destructive Migrations:** None. All migrations use `IF NOT EXISTS` or safe additive operations.

---

## 14. Backup & Rollback Readiness

| Area | Status | Rollback / Backup Strategy |
| :--- | :---: | :--- |
| **Database Data** | **READY** | Supabase daily automated database backups and Point-In-Time-Recovery (PITR) on Pro tier |
| **Database Migrations** | **READY** | 9 discrete, versioned SQL migration files tracked in Git (`supabase/migrations/`) |
| **Application Deployments** | **UNKNOWN** | Depends on chosen hosting provider (instant rollback available on Cloudflare Pages / Vercel) |
| **Storage Binaries** | **READY** | Stored on AWS S3 / Supabase Storage infrastructure |

---

## 15. Production Smoke-Test Plan

```markdown
### 1. Public Pages & SEO
- [ ] Visit `/` (Homepage renders hero, featured cakes, Bakery JSON-LD)
- [ ] Visit `/menu` (Catalog displays all Supabase & Shopify products)
- [ ] Visit `/product/belgian-chocolate-ganache-cake` (Product details, price in LKR, Product JSON-LD)
- [ ] Visit `/custom-orders` (Inquiry form with image uploader renders)
- [ ] Visit `/about`, `/contact`, `/testimonials` (Pages render with canonical links)
- [ ] Inspect `/robots.txt` and `/sitemap.xml` in browser

### 2. Authentication Flow
- [ ] Register a new customer account
- [ ] Log in with existing customer credentials
- [ ] Request password reset email from `/forgot-password`
- [ ] Click reset link and update password on `/reset-password`
- [ ] Log out successfully

### 3. Customer Custom Order Lifecycle
- [ ] Submit a new custom cake inquiry on `/custom-orders` with 1-2 reference images
- [ ] Verify reference images upload to private `cake-references` bucket
- [ ] Navigate to `/account` and verify order appears with status `received`
- [ ] Verify signed image URLs display customer reference photos
- [ ] Verify private notes (`internal_notes`, `payment_reference`) are NOT visible in DOM or network responses

### 4. Admin Management & Quotation
- [ ] Log in as admin and access `/admin/orders`
- [ ] Open newly submitted custom order
- [ ] Enter quoted price (e.g. LKR 15,000) and required deposit (e.g. LKR 5,000)
- [ ] Issue quote (status -> `quoted`)
- [ ] In customer `/account`, verify quote card appears with Accept Quote / Decline buttons
- [ ] Accept quote as customer (status -> `quote_accepted`)
- [ ] In `/admin/orders`, verify payment recording (record bank transfer deposit)
- [ ] Transition status to `in_baking` -> `ready_for_pickup` -> `completed`

### 5. Transactional Email Delivery
- [ ] Verify `pg_net` trigger fires upon notification creation
- [ ] Verify Edge Function receives event and Resend successfully dispatches email with `Reply-To: scfrostheaven@gmail.com`
- [ ] Check customer inbox for branded HTML milestone notification

### 6. Cart & Checkout
- [ ] Add Shopify product to cart (`/product/chocolate-indulgence`)
- [ ] Add Supabase cake to cart (`/product/belgian-chocolate-ganache-cake`)
- [ ] Open Cart Drawer, update quantities, test delivery fulfillment calculation
- [ ] Verify direct checkout flow
```

---

## 16. Master Classification Table

| Area | Status | Evidence | Required Action |
| :--- | :---: | :--- | :--- |
| **Repository & Code Quality** | **READY** | `bunx tsc --noEmit` clean; `bun run build` passes | None |
| **Database Migrations** | **READY** | All 9 migrations synchronized locally and remotely | None |
| **Customer RLS & RPC Security** | **READY** | `get_my_custom_orders()` active; `customer_custom_orders` view dropped | None |
| **Storage Buckets** | **READY** | `cake-references` (private, signed URLs) & `menu-images` (public) configured | None |
| **Shopify Integration** | **READY** | Storefront API token & product catalog operational | None |
| **SEO & Sitemap** | **READY** | XML sitemap (15 URLs), robots.txt, and JSON-LD verified | None |
| **Transactional Email (Resend)** | **BLOCKER** | Sender `@gmail.com` returns HTTP 403 on Resend; needs verified sending domain | Verify domain in Resend & set `RESEND_FROM_EMAIL` in Edge Function secrets |
| **Supabase Auth Redirects** | **NEEDS MANUAL CONFIGURATION** | Redirect URLs currently default to window.location.origin | Add production domain to Supabase Auth Allow List |
| **Hosting & CDN Deployment** | **NEEDS MANUAL CONFIGURATION** | Hosting provider not yet established in repository CI | Connect repository to Cloudflare Pages / Vercel / Netlify |
| **Domain & DNS** | **NEEDS MANUAL CONFIGURATION** | `VITE_SITE_URL` defaults to `https://scfrostheaven.com` | Point DNS records to hosting provider once domain is confirmed |

---

## 17. Final Blocker List

1. **Resend Sending Domain Verification (Critical Blocker)**:
   - Resend requires a verified custom domain for `From` headers.
   - Action: Add and verify domain in Resend DNS settings; update `RESEND_FROM_EMAIL` secret in Supabase.

---

## 18. Exact Manual Actions Required Before Deployment

1. **Resend Email Configuration:**
   - Register sending domain in [Resend Dashboard](https://resend.com/domains).
   - Add the 3 DNS records (DKIM, SPF, MX) provided by Resend to your domain registrar.
   - Set the Edge Function secret:
     ```bash
     bunx supabase secrets set RESEND_FROM_EMAIL="SC Frost Heaven <orders@yourdomain.com>"
     ```
2. **Supabase Auth Configuration:**
   - In [Supabase Dashboard](https://supabase.com/dashboard) > Project `xaqczelrmlhjhfjxlwzv` > Authentication > URL Configuration:
     - Set **Site URL** to `https://<your-production-domain>`.
     - Add `https://<your-production-domain>/**` to **Redirect URLs**.
3. **Hosting Setup:**
   - Connect GitHub repository `Chamalka-heshi/SC-FrostHeaven` to Cloudflare Pages (or chosen provider).
   - Configure Build Command: `bun run build` (or `npm run build`).
   - Configure Output Directory: `.output/public` (or `.output` for full-stack Nitro).
   - Set Environment Variables:
     - `VITE_SITE_URL=https://<your-production-domain>`
     - `VITE_SUPABASE_URL=https://xaqczelrmlhjhfjxlwzv.supabase.co`
     - `VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...`

---

## 19. What is Explicitly NOT Verified
- Live DNS propagation of the custom production domain (domain registrar access is external).
- Resend custom domain DNS verification status in third-party DNS control panel.
- Third-party Shopify payment gateway / live merchant bank account status in Shopify Admin.

---

## 20. Recommended Next Step
- Complete the manual Resend domain verification and Supabase Auth URL configuration, then proceed to select and connect the production hosting provider.
