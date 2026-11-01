# Quotation and central godown foundation

These foundations are additive and use the existing static material catalogue as their product master. They do not update or delete existing catalogue, enquiry, booking, or customer data.

## Quotation system

- Admin quotation list, enquiry-to-quotation prefill, product/custom-service lines, customer details, terms, discounts, and editable admin-entered rates.
- Unique `QTN-YYYYMM-######` numbers generated transactionally in India time; draft revisions, status history, and immutable snapshots.
- A private PDF endpoint generates A4 quotation files from saved database records. PDFs identify themselves as quotations (not invoices or confirmed orders); no customer email is sent.
- Line GST is calculated only from verified catalogue tax metadata or an HTTPS source/date entered for a custom service. Rates are never guessed. Freight and other-charge tax treatment is explicitly flagged for review.
- Saving a quotation does not reserve or deduct stock. No orders, payment collection, invoice issuance, or automatic customer communication is enabled.

## Central godown inventory

- Admin-only balance and movement-history views in `/admin/`.
- Stock receipts, returns, dispatch, installation issue, supplier return, damage, and adjustments through an authenticated server endpoint.
- An atomic database function locks each product balance, rejects overselling and invalid reservations, and uses an idempotency key to prevent duplicate movements.
- Opening stock can be recorded once per product. Later corrections use an adjustment and a reference.
- Ledger updates and deletes are blocked. Products without a recorded opening/receipt are shown as **Not recorded**, not assumed to have zero stock.

Reservation primitives exist for later confirmed-order workflows, but quotation actions do not reserve stock. No order, checkout, payment, reorder alert, stock valuation, or public stock-availability workflow is enabled yet.

## Database setup and backup

Review these additive SQL files:

1. [`20261029_000001_catalogue_metadata.sql`](../supabase/migrations/20261029_000001_catalogue_metadata.sql) — required only to calculate GST from verified catalogue tax metadata.
2. [`20261029_000002_inventory_ledger.sql`](../supabase/migrations/20261029_000002_inventory_ledger.sql) — stock balances and movement ledger.
3. [`20261029_000003_quotations.sql`](../supabase/migrations/20261029_000003_quotations.sql) — quotations, line items, revisions and status history.

**No Supabase migration was run by this work.** For the separate `HM ELECTRICAL TEST` project, review and apply the migrations in this order:

1. [`20261029_000001_catalogue_metadata.sql`](../supabase/migrations/20261029_000001_catalogue_metadata.sql) — creates the admin-only metadata overlay; required for verified catalogue GST calculations.
2. [`20261029_000002_inventory_ledger.sql`](../supabase/migrations/20261029_000002_inventory_ledger.sql) — creates stock balances, immutable movement ledger, and the atomic movement RPC.
3. [`20261029_000003_quotations.sql`](../supabase/migrations/20261029_000003_quotations.sql) — creates quotation counters, quotes, lines, immutable revision/status history, and transactional RPCs.

The metadata migration is not needed for a no-GST quotation, but is included for a complete catalogue-tax staging setup. Inventory is independent of quotations, but this order follows the migration sequence. These files create new objects; they do not import the existing 984 products or copy enquiries. The product catalogue is bundled with the application. A clean TEST project needs a Supabase Auth admin user; add that user's UUID to the local TEST-only allowlist. Creating an enquiry-prefill workflow additionally requires the existing `enquiries` schema/data, which these module migrations do not create or copy. A manual quotation without a source enquiry and inventory movement testing do not require it.

Before any database change:

1. Make or verify a recoverable Supabase backup using the project's available backup/export process. Confirm that existing catalogue and customer/enquiry records can be restored.
2. Confirm the Supabase Dashboard project selector and project reference say `HM ELECTRICAL TEST`; do not use production.
3. Apply the three migrations above one at a time in the TEST project's SQL Editor. Review each result before continuing. These migrations do not copy production data.
4. Optionally run [`seed-test-data.sql`](../supabase/staging/seed-test-data.sql) in that TEST project's SQL Editor. It creates a clearly labeled fake quotation and one opening-stock fixture for existing product `MAT-8000`; the stock ledger is append-only, so keep the reference marked as test data. Re-running it will not duplicate those fixtures.
5. Test PDF, stock movement, permissions, and any existing enquiry/booking flows separately. Do not copy production enquiries to TEST unless separately approved and safely anonymized.

Production execution still requires the owner's explicit approval.

Do not roll back by dropping the new tables after recording quotations or stock: that would erase audit history. If a feature must be disabled, stop using its endpoint and preserve its data until an approved retention plan exists.

## Local checks and isolated Netlify Dev

The existing root `.env` is not used or modified by the TEST launcher. The `.gitignore` rule ignores `.env.test`.

1. In PowerShell, from the project root, copy `env.test.example` to `.env.test`.
2. In `.env.test`, enter only the TEST project's reference, URL and Supabase keys. Create an admin user in the TEST project's Supabase Auth and put that user's UUID in `ADMIN_USER_IDS`. Set `RATE_LIMIT_SECRET` to a new local random string (at least 32 characters). Keep `SITE_ORIGIN=http://localhost:8888`, `HM_EMAIL_PROVIDER_TOKEN=`, and `EMAIL_FROM=` unchanged.
3. Do not paste the values into chat or commit `.env.test`. The TEST launcher validates that the URL host matches `HM_TEST_SUPABASE_PROJECT_REF`, requires the localhost origin, disables email, and starts Netlify Dev with `--offline` so linked-site environment values are not fetched. Its child process receives only required TEST settings and a small Windows runtime-variable allowlist; it does not inherit production Supabase credentials or Netlify auth tokens.
4. Start with `npm.cmd run dev:test`; open `http://localhost:8888/admin/` and sign in using the TEST project's admin user.
5. Use the `Quotations` tab to create a clearly labeled test draft with `No GST calculation`, save it, and download its PDF. Or use the optional seeded PDF fixture. Do not send the PDF to a customer.
6. Use the `Inventory` tab to test a test-only opening movement and a smaller dispatch. The optional fixture already records 10 units for `MAT-8000`; use a different product or inspect its balance before adding any test movement. Do not try to remove ledger entries.

If TEST migrations or tables are absent, database-backed pages report setup errors; do not switch to the production `.env` to make the screen work.

Run all mocked automated tests and the local static build with:

```powershell
node --test
npm.cmd run build
```

The tests use mocks/in-memory data and do not write to Supabase. No email/Resend configuration or payment credentials are needed.
