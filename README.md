# HM ELECTRICAL — Final Website Code

Updated: 17 November 2026
Live website: https://hmelectricalb2b.com/
Single Admin entry: https://hmelectricalb2b.com/admin/

This folder is the maintained source project. Edit public/ for the website and admin interface. Do not keep another editable copy of the same project.

## Folder guide

- public/: website, catalogue, AI chat interface, product photos, public downloads and Admin.
- netlify/functions/ and server/: existing enquiry, pricing, PDF, notification and AI backend.
- database/ and supabase/migrations/: database definitions and migration history. Keep these for maintenance; do not reapply blindly to the live database.
- scripts/: build and validation tools.
- tests/: regression checks for enquiries, pricing, privacy, Admin and downloads.
- package.json, package-lock.json and netlify.toml: required dependency and deployment configuration.

## Daily Admin use

Home → Customer enquiries → Products & rates → Suppliers → Letterhead & PDFs.
Advanced tools are under More. Business totals are collapsed on Home. Buying rates and supplier discounts stay private; only approved public prices are shown to customers.

The public catalogue contains 3,541 source specifications across 15 categories. Approved live Admin records can add or hide materials. Civil work is excluded from the public service offering.

## Build

Use Node 22 or later. Run npm ci to install the locked dependencies.

For a local staging build: npm run build
For checks: npm test

For an owner-authorised production build, set HM_SITE_MODE=production, HM_LAUNCH_APPROVED=true and CONTEXT=production, then run npm run build. Netlify already has the approved production configuration.

Build output is generated in dist/. It is not another source project. Netlify publishes dist/ and packages netlify/functions/ separately. A static upload alone cannot run the enquiry, Admin or AI backend.

Runtime credentials remain in the existing private hosting configuration. Never put real credentials, .env files, database exports or customer/employee documents in a public ZIP or Git commit. The example environment files contain variable names only.

## Current website

The homepage has a material-first storefront, catalogue-wide search, category shortcuts, quotation cart, technician enquiries and the existing AI chat. Public SEO routes and existing PDF downloads are retained. Stock, delivery and final quotations require company confirmation.

## Source delivery

The final source ZIP contains tracked source and configuration templates only. Installed dependencies, dist/, local credentials, Git history, old code snapshots and temporary test/build bundles are excluded.
