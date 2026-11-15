# HM ELECTRICAL enquiry assistant

Owner-approved AI planning budget: maximum INR 500/month, confirmed 15 November 2026.

## Ready without paid integrations

- Public catalogue guidance on the homepage: product identity search and transfer to the existing consent-based enquiry form. No prices/costs guessed; no civil offering.
- `/admin/assistant.html` uses the existing Admin MFA session. Website enquiries and private external/Justdial records share one inbox.
- Standard reply begins **Hi**, identifies Asif / HM ELECTRICAL, uses **8085560156**, asks missing material details, and promises only a checked quotation.
- Approved reply is saved/copied, not sent. No supplier purchase data enters the customer template or AI prompt.
- External leads are deduplicated by provider reference. The webhook is off by default.

## OpenAI connection (not activated by adding this code)

Use a dedicated project/key and server-side Netlify Function environment variables `OPENAI_API_KEY` and `HM_AI_ENABLED=true`. Never save credentials in this repository, frontend, HTML, screenshots or chat. Account/billing/terms remain owner steps.

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
