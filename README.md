# HM ELECTRICAL — final website project

Original GitHub repository description: HM ELECTRICAL ONLINE B2B METRIAL STORE.

Prepared 29 October 2026. Local tested release candidate; unpublished. Default build is staging/noindex. No real customer data or credentials are included.

## What is included

- 984 original material specifications and 119 contracting work items; IDs preserved.
- Fast search across names, category, product/source codes, specification, size and curated common aliases; category filters, category shortcuts, 12 products per page, and direct links from cards to SEO product pages.
- Multi-item RFQ cart, required-date/company capture, WhatsApp fallback and optional email notification.
- 984 static specification pages and 15 category pages; all accessible without JavaScript.
- Private admin authentication and enquiry/booking management; existing inventory and quotation tools retained inside admin.
- Technician request form, private photo handling, project register and team.
- Verified MRP policy. Current catalogue has no verified manufacturer MRP, so all prices remain on request. The admin metadata overlay is private and does not automatically publish prices.
- The source catalogue has no per-product photos, HSN values or separate descriptive-specification fields. Product pages expose available source fields and explicitly mark those gaps rather than inventing details or presenting category illustrations as product photos.
- Netlify Functions, SQL setup/migrations, locked dependencies, automated tests.

## Local use

Install Node 22 or later. In this folder run `npm ci`, `npm test`, then `npm run build`.
`public/` is the single website source. `dist/` is generated and contains staging settings by default. Rebuilding replaces only generated `dist/` content. Do not edit dist directly.

For a static visual preview, serve dist on loopback. A static server cannot run Functions or save enquiries. For full local function testing, copy `.env.example` to `.env`, configure an isolated test Supabase project, and use `npm run dev`. Never point test submissions at production. `npm run dev:test` additionally enforces the isolated project/origin, disables email, and builds its private staging site under the system temporary directory without replacing `dist/`; see `env.test.example`.

## Database setup

Use a new, isolated Supabase test project. Apply, in order:

1. `database/setup.sql` (base enquiry table, rate limit and notification RPCs).
2. `server/service-bookings.sql` (booking tables and private storage bucket).
3. The four files under `supabase/migrations/` in filename order (metadata, inventory, quotations, then RFQ company/required-date fields).

These scripts were validated in an isolated in-memory PostgreSQL runtime with Supabase-like roles/storage tables. They have not been applied to a hosted Supabase project. The RFQ UI checks for the additive company/date columns before saving and fails with a migration message rather than silently dropping those details. Compare schemas and back up before any existing-database migration. Do not use sample fixtures on production. No migration runs automatically during build or deployment.

Create the intended Supabase admin account privately and put its UUID in `ADMIN_USER_IDS`. Set `SUPABASE_SERVICE_ROLE_KEY` to the matching project's server-only Supabase secret key, or its legacy `service_role` JWT. Modern `sb_secret_` keys are sent only in the `apikey` header; legacy JWT keys also use bearer authorization. Never expose either key in browser code. Populate the variable names in `.env.example`; use a long random `RATE_LIMIT_SECRET`. Optional email requires a verified Resend sender. Configure `SITE_ORIGIN` to exactly match the protected staging origin; it is checked for write requests.

## Protected Netlify staging — only when authorized

No site was created, published, or linked. Keep local files private meanwhile.
Configure Netlify visitor access as private/team access, or password protection where available, for **all staging deploys**, including their functions and alternate deploy URLs. A private GitHub repository and noindex alone do not protect a hosted website. Confirm access from a signed-out browser before using real data.

Use build command `npm run build`, publish directory `dist`, and functions directory `netlify/functions` (already declared in netlify.toml). Do not use static Netlify Drop for this full project: it does not perform the required backend setup.

Only after access protection is configured, set `HM_PRIVATE_TESTING_ACK=true` for protected staging. Leave `HM_SITE_MODE` absent or set it to `staging`; leave `HM_LAUNCH_APPROVED` unset. The build fails on Netlify without the staging acknowledgement. The acknowledgement is an operator safeguard, not an automatic audit of the provider's access settings.

Test a synthetic enquiry, confirm its stored reference in the staging database and admin, test status changes, sign-out, unauthorized API access, booking/photo access, and email retry. Confirm no real customer email or data is used. Hosted saving, authentication and delivery remain launch gates.

## Public launch — requires separate approval after staging tests

The intended canonical domain is `https://hmelectricalb2b.com`. No domain/DNS changes were made. Confirm ownership and the desired primary hostname.

After functional testing, business/photo approval and explicit launch authorization, set `HM_SITE_MODE=production` and `HM_LAUNCH_APPROVED=true` only in Netlify's production build context. Keep previews in staging mode. Public mode is rejected in non-production Netlify contexts. If hosting staging on a separate site's production context, it must still use staging mode.

Public mode removes the private banner, enables index/follow on the homepage, catalogue, tools page, categories and product pages, and emits a 1,003-URL sitemap at `/sitemap.xml` (984 products, 15 categories, the category directory and three public HTML pages). The company profile, privacy page and image/pricing policy retain `noindex,nofollow` and stay out of the sitemap. Admin stays out of the sitemap and retains `noindex`, `no-store` and the `/admin/` crawl exclusion; these crawler directives are not access control, so admin API authentication and hosting access controls remain required. Canonicals and Organization metadata point to hmelectricalb2b.com. There are no fabricated ratings, stock claims, manufacturer offers or product rich-result guarantees. Configure primary-domain redirects for alternate hostnames in Netlify when launching.

## Google Search Console

After domain ownership is confirmed, add the Domain property and complete Google's DNS TXT verification. No verification token was supplied, invented or installed. After the approved launch, submit `https://hmelectricalb2b.com/sitemap.xml`; inspect the homepage, one category and representative product URLs with URL Inspection. Check crawl access, Google-selected canonical, mobile rendering and indexing reports. A sitemap or SEO code does not guarantee indexing or ranking.

## MRP and content review

Retain “MRP on request” until the exact manufacturer, SKU/model, official price source URL and verification date are recorded and checked. Source data and private admin imports do not prove manufacturer verification. No private selling rates are published. Team/site photos and project/client names were supplied in the original project; confirm permission and factual accuracy before release.

## Backups and old versions

The original uploaded ZIP remains intact and a local backup is preserved separately from this deliverable. No old folder, repository, Netlify site, domain or customer record was deleted. After final staging verification, identify each obsolete item by exact path/name/URL, preserve a recoverable backup, and obtain explicit confirmation before deletion. Never infer deletion permission from this README.

## References

- [Netlify deploy and preview access](https://docs.netlify.com/deploy/deploy-overview/)
- [Netlify visitor protection](https://docs.netlify.com/manage/security/secure-access-to-sites/password-protection/)
- [Google canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization)
- [Google indexing guidance](https://developers.google.com/search/help/crawling-index-faq?hl=en)

See `AUDIT-REPORT.md` for verification and remaining launch gates.
