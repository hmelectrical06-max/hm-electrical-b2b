# HM ELECTRICAL enquiry assistant

Owner-approved AI planning budget: maximum INR 500/month, confirmed 15 November 2026.

## Ready without paid integrations

- Public catalogue guidance on the homepage: product identity search and transfer to the existing consent-based enquiry form. No prices/costs guessed; no civil offering.
- `/admin/assistant.html` uses the existing Admin MFA session. Website enquiries and private external/Justdial records share one inbox.
- Standard reply begins **Hi**, identifies Asif / HM ELECTRICAL, uses **8085560156**, asks missing material details, and promises only a checked quotation.
- Approved reply is saved/copied, not sent. No supplier purchase data enters the customer template or AI prompt.
- A Netlify scheduled function prepares up to three previously undrafted enquiries every 15 minutes. It makes no paid AI calls and sends nothing. Stable request IDs prevent duplicate scheduled drafts. Closed website enquiries are excluded.
- External leads are deduplicated by provider reference. The webhook is off by default.

## OpenAI connection (not activated by adding this code)

The legacy Admin staff-note path uses `OPENAI_API_KEY` and `HM_AI_ENABLED`, but **must remain disabled on the current hosting plan**. Use the runtime-only customer chat connection below instead. Never save credentials in this repository, frontend, HTML, screenshots or chat. Account/billing/terms remain owner steps.

Paid generation is Admin-only and produces a **private requirement-check note**, while customer reply stays deterministic and editable. GPT-4.1 mini snapshot, at most 12,000 request bytes and 500 output tokens; no tools, retries or stored provider response. A database lock reserves INR 5 allowance per attempt, at most 100 attempts per India calendar month. Failed attempts remain reserved; standard drafts remain free. INR 500 is the app planning limit, not a provider invoice guarantee: external key usage, FX/tax changes, hosting and messaging are outside it. Model prices verified 2026-11-15 at https://developers.openai.com/api/docs/models/gpt-4.1-mini ($0.40 input / $1.60 output per million). Paid analysis automatically stops for price review after 2026-12-15.

## Justdial connection (manager action + live test pending)

Receiver: `https://hmelectricalb2b.com/.netlify/functions/justdial-lead`.
It requires POST JSON, `Authorization: Bearer <server-only random secret of at least 32 characters>`, and `HM_JD_WEBHOOK_ENABLED=true`. Configure `HM_JD_WEBHOOK_SECRET` only in server environment settings and share securely with Justdial's authorised integration team, never public catalogue/email logs.

Expected JSON: `lead_id`, `name`, `phone`, optional `email`, `location`, `details` (required). Recognised aliases: `enquiry_id`/`ENQ_ID`, `customer_name`/`NAME`, `mobile`/`MOBILE`, `EMAIL`, `city`/`CITY`, `requirement`/`QUERY`. **These are our receiver's contract, not a claim of Justdial's actual payload.** Confirm their authentication and sample payload first; adapt/test if different. No secret in URL; no unverified source allowed. Successful push does not send a reply or mark Justdial's lead converted.

Manager request draft: "Please confirm lead push/API/CRM integration availability and charges for HM ELECTRICAL listing 022PXX22.XX22.240913061126.T8W9. We want Justdial enquiries in our private website CRM. Please provide the supported authentication method, sample payload, retry/deduplication behaviour and test process. Please also verify why the AI WhatsApp template uses callback 8733079652 while our business contact is 8085560156. Do not change the package or activate chargeable add-ons without our approval."

## Automatic WhatsApp is not connected

Owner must choose/authorise an official WhatsApp Business Platform connection, verify the number, permissions and templates, and approve any additional message/provider costs. Do not treat competitor-category leads as opted-in WhatsApp contacts. No unsolicited bulk sending or guessed delivery commitment. Existing Justdial AI template with unconfirmed callback is not used.

## Deployment and verification

Apply `database/enquiry-assistant.sql` as an additive production migration after tests. Run assistant security/functional tests and full build. Verify unauthenticated Admin denial, public response privacy, disabled Justdial hook, a standard draft in the authenticated workspace, and budget concurrency in an isolated DB. Do not send fake test leads to real customers. Record deployment ID and remaining external activation steps.
# Direct website enquiry chat — 15 November 2026

## Current hosting: runtime-only secret

The Personal Netlify plan rejects functions-only scopes. Do **not** fall back to an OpenAI key in its default build/post-processing environment. Automatic approval review rejected that broader credential exposure. The local Netlify-key connector is retired.

The supported route is the authenticated Supabase Edge Function `hm-enquiry-ai` in existing HM ELECTRICAL project `qftvchsrqaevkfkhbnrj`. Store the dedicated business OpenAI key only as the **Edge Function Secret `HM_OPENAI_API_KEY`** through the Supabase dashboard. The owner has approved this specific runtime destination. No OpenAI key is sent to Netlify, source files, build output, or the browser.

After the runtime secret is saved and tested, set only non-secret Netlify production flags `HM_CUSTOMER_AI_ENABLED=true` and `HM_CUSTOMER_AI_VIA_SUPABASE=true`. Keep `HM_AI_ENABLED=false` for the separate legacy staff-note feature. Rebuild the server deployment and require a real `mode: ai-chat` test before claiming activation.

The runtime authenticates the existing server key through the service_role-only `hm_ai_reserve` RPC, which atomically limits each request/month. Anonymous and authenticated browser roles have no execute grant. The API request ID is reused across the proxy so a request reserves allowance only once. `verify_jwt=false` is intentional for service-to-service secret keys; handler authorization is mandatory. The OpenAI key is accessible only inside the runtime, not in Netlify's build or post-processing environment.

OpenAI billing was verified: $11.80 paid, $10 API credit, automatic recharge disabled. This is not a ₹500 monthly subscription. App allowance remains at most 100 attempts/month at ₹5 reserved per attempt, shared with verification attempts; actual provider billing is usage-based.

The website widget now keeps a bounded conversation in page memory and transfers the customer's requirements into the existing enquiry form. It does not submit that form, contact a customer externally or confirm prices, stock, delivery or technician bookings. The existing enquiry form sends office email after submission.

With the runtime connection above, OpenAI selects the next missing enquiry question using a strict schema. Customer-facing text is a vetted question, never arbitrary model text. Each turn reserves one of the same 100 monthly ₹5 planning allowances. Without connection, allowance, or provider availability, the widget labels itself **Guided chat** and continues without paid calls. Price review remains due after 15 December 2026. This allowance excludes other usage on the same provider account and messaging/hosting charges.

Justdial external replies and WhatsApp owner alerts on 8085560156 remain disconnected pending supported API/CRM and messaging credentials. Never reuse Groww trading tokens for AI. Do not use the proprietor's personal OpenAI account for this business integration.

# Customer email confirmations (15 November 2026)

Owner clarified intake: customer-facing MRP is the available verified printed list MRP, not discounted buying cost or a final selling quotation. Technician/labour requests must collect actual work/tasks, site locality/landmark (full address or Maps link in the contact form), date, and for crew requirements the trade/team size and duration/shift. A generic "electrician in Mumbra tomorrow" cannot finish intake without work details and a site landmark. Civil remains excluded. The website enforces this sequence even when the model skips a question or the provider is unavailable. Customer email confirmations ask the same work/location details and include the company signature. Owner chose **website + email only** for this release; no calling, WhatsApp or SMS service is activated.

The owner authorizes transactional acknowledgement and work/material clarification for electrical/plumbing enquiries. Final selling prices, service charges, technician availability and dispatch remain owner-confirmed. This does not authorize promotions or unrelated customer messages.

`HM_CUSTOMER_EMAIL_ENABLED=true` and `HM_CUSTOMER_EMAIL_START_AT` enable confirmation email for new, consented website enquiries with an email address. All three intake forms are supported; the service booking form now has an optional email field. The existing five-minute `notify` schedule prepares/retries confirmations. `hm_customer_replies` is a private, immutable-payload outbox with one message per source enquiry, a ten-minute claim lease, six attempts, three acknowledgements per recipient/day and fifty/day globally. Retries expire at 22 hours, before Resend's 24-hour idempotency window, and become manual-review items. Existing accepted messages are not replayed. Historic enquiries are not bulk emailed. Only a specifically authorized current enquiry may be queued as a catch-up.

Customer emails start with Hi, repeat their request, ask actual work/material specifications, exact location and timing, and request their confirmation. Email `Reply-To` is the business inbox: **email replies are for office review, not an unattended AI email conversation**. Interactive AI remains on the website chat linked in the email. WhatsApp/SMS and Justdial outgoing messages are still not connected.

Public website chat may disclose verified **printed MRP references only**, matched to make, material family, size/grade/length or exact manufacturer SKU. It does not infer buying price from discounts. The public response uses a narrow whitelist and never returns supplier IDs, source documents, discounts, landed cost or margin. Missing/ambiguous references ask for specifications instead of inventing a rate. MRP references are dated list values, not stock, latest-market-price or final quotation promises. Service prices always require office review.

