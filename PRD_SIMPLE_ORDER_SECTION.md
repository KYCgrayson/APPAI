# PRD: Native Simple Order Section

## Summary

Add a first-class AppAI section named `simple-order` for small shops that need a hosted order request flow without deploying a separate app. The section lets visitors enter free-form order line items, automatically calculates totals, shows a LINE/payment instruction step, and emails the shop owner after the visitor confirms payment.

## Problem

AppAI currently has strong page, form, tool, action, and iframe capabilities, but none of the native sections can reliably handle a simple order workflow:

- `form` collects fields but does not support repeatable line items or total calculation.
- `tool` requires an external backend API.
- `iframe-tool` requires deploying a separate web app, which is explicitly not desired for this use case.

## Goals

- Let agents create an order page entirely on AppAI with a normal page payload.
- Support free-form item name, quantity, and unit price entry.
- Calculate line-item subtotals and total cost in the browser.
- Show a clear payment instruction step with a LINE/payment URL.
- Let the visitor submit only after confirming payment.
- Notify the shop owner by email with the order details and the customer's reply email.
- Make the owner confirmation expectation explicit: the owner confirms quantity and date by email.

## Non-Goals

- Automatic payment verification.
- Inventory management.
- Product catalog management.
- Order database/history.
- Refund or fulfillment workflow.

## User Flow

1. Visitor sees the shop/order section on an AppAI-hosted page.
2. Visitor enters name, email, preferred date, optional note, and one or more line items.
3. Section calculates subtotals and total.
4. Visitor clicks checkout.
5. Section displays payment instructions and LINE/payment link.
6. Visitor completes payment externally.
7. Visitor clicks "I paid, send order".
8. AppAI validates the stored page section config and submitted order, recalculates the total server-side, and emails the shop owner.
9. Visitor sees a success message explaining that the owner will confirm quantity and date by email.

## API / Content Model

New section type: `simple-order`

Required data fields:

- `notificationEmail`: shop owner email address
- `paymentUrl`: LINE/payment/contact URL

Optional data fields:

- `heading`
- `description`
- `storeName`
- `storeDescription`
- `currency`
- `paymentHeading`
- `paymentInstructions`
- `submitLabel`
- `successMessage`
- `maxItems`

## Runtime Requirements

Server-side email delivery uses Resend via:

- `RESEND_API_KEY`
- `APPAI_EMAIL_FROM` optional, defaults to `AppAI Orders <onboarding@resend.dev>`

If email is not configured, the API returns a clear 503 error.

## Acceptance Criteria

- `GET /api/v1/sections` lists `simple-order`.
- `simple-order` renders inside AppAI pages without iframe or external deployment.
- Visitors can add/remove items and see totals update instantly.
- Checkout displays payment instructions and opens the configured payment URL.
- Submission posts to AppAI and uses the saved page section config, not client-supplied owner email.
- Server recalculates totals before sending email.
- Invalid submissions return 400.
- Missing email provider config returns 503.
- Lint and production build pass.
