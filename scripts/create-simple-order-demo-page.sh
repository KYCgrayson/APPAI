#!/bin/bash
# Create a demo page that uses the native simple-order section.
#
# Required:
#   API_KEY=appai_sk_xxx
#
# Optional:
#   API_BASE=http://localhost:3000   # default: https://appai.info
#   SLUG=demo-simple-order           # default: demo-simple-order
#   NOTIFICATION_EMAIL=owner@example.com
#   PAYMENT_URL=https://line.me/R/ti/p/@yourline
#
# Example:
#   API_KEY=appai_sk_xxx API_BASE=http://localhost:3000 \
#   NOTIFICATION_EMAIL=you@example.com \
#   PAYMENT_URL=https://line.me/R/ti/p/@yourline \
#   bash scripts/create-simple-order-demo-page.sh

set -e

if [ -z "$API_KEY" ]; then
  echo "ERROR: API_KEY environment variable is required."
  echo "Usage: API_KEY=appai_sk_xxx bash scripts/create-simple-order-demo-page.sh"
  exit 1
fi

API_BASE="${API_BASE:-https://appai.info}"
SLUG="${SLUG:-demo-simple-order}"
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-owner@example.com}"
PAYMENT_URL="${PAYMENT_URL:-https://line.me/R/ti/p/@yourline}"

API="${API_BASE}/api/v1/pages?upsert=true"
AUTH="Authorization: Bearer ${API_KEY}"
CT="Content-Type: application/json"

echo "Creating simple-order demo page at ${API_BASE}/p/${SLUG}"

PAYLOAD=$(cat <<JSON
{
  "slug": "${SLUG}",
  "title": "Sunny Bakery Order",
  "tagline": "Order custom items, pay through LINE, and wait for owner confirmation by email.",
  "themeColor": "#059669",
  "themeColorSecondary": "#F59E0B",
  "fontFamily": "Noto Sans TC",
  "isPublished": true,
  "category": "COMMERCE",
  "content": {
    "sections": [
      {
        "type": "hero",
        "order": 1,
        "data": {
          "headline": "Sunny Bakery",
          "subheadline": "Custom cakes and small-batch treats. Submit your paid order and we will confirm quantity and date by email.",
          "heroHeight": "medium",
          "backgroundColor": "#064E3B",
          "ctaText": "Place an order",
          "ctaUrl": "#order"
        }
      },
      {
        "type": "simple-order",
        "order": 2,
        "data": {
          "id": "order",
          "heading": "Place an order",
          "description": "Enter your requested items, quantity, unit price, and preferred pickup date. After payment, submit the order and the owner will confirm quantity and date by email.",
          "storeName": "Sunny Bakery",
          "storeDescription": "Small-batch bakery orders with manual owner confirmation.",
          "notificationEmail": "${NOTIFICATION_EMAIL}",
          "paymentUrl": "${PAYMENT_URL}",
          "paymentHeading": "Please complete payment",
          "paymentInstructions": "Please pay through the LINE/payment link first. After payment, submit this order. The shop owner will confirm quantity and date, then reply by email.",
          "currency": "TWD",
          "submitLabel": "I paid, send order",
          "successMessage": "Order sent. The owner will confirm quantity and date by email.",
          "maxItems": 20
        }
      },
      {
        "type": "faq",
        "order": 3,
        "data": {
          "items": [
            {
              "question": "Does this automatically verify payment?",
              "answer": "No. This demo shows a payment link and sends the order after the customer confirms payment. The owner checks payment, quantity, and date manually."
            },
            {
              "question": "Can customers type any item?",
              "answer": "Yes. This flow is designed for flexible or custom orders where the customer enters the item name directly."
            }
          ]
        }
      }
    ]
  },
  "privacyPolicy": "## Privacy Policy\\n\\nThis demo collects order details, customer email, requested date, and notes only to notify the shop owner. Payment happens through the configured external payment link.",
  "termsOfService": "## Terms of Service\\n\\nSubmitting an order does not guarantee availability until the shop owner confirms quantity and date by email. This demo does not automatically verify payment."
}
JSON
)

curl -s -X POST "$API" -H "$AUTH" -H "$CT" -d "$PAYLOAD" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps({'slug': d.get('slug'), 'error': d.get('error'), 'warnings': d.get('warnings')}, ensure_ascii=False, indent=2))"

echo "URL: ${API_BASE}/p/${SLUG}"
