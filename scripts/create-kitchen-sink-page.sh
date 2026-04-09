#!/bin/bash
# ============================================================
# create-kitchen-sink-page.sh
# ------------------------------------------------------------
# Creates a single hosted page at /p/qa-kitchen-sink that
# exercises EVERY available section type (all 18). This page
# is the canonical baseline for mobile responsive QA
# (375 / 768 / 1440 px) and future visual regression testing.
#
# Sprint 1 Team C task #13.
#
# Required env vars:
#   API_KEY   AppAI API key, format appai_sk_YOUR_KEY
#
# Optional env vars:
#   API_BASE  Override API host (default: https://appai.info)
#             Example for local dev: API_BASE=http://localhost:3000
#
# Usage:
#   API_KEY=appai_sk_YOUR_KEY bash scripts/create-kitchen-sink-page.sh
#   API_KEY=appai_sk_YOUR_KEY API_BASE=http://localhost:3000 \
#     bash scripts/create-kitchen-sink-page.sh
#
# The script is idempotent: it uses POST ?upsert=true so re-runs
# simply overwrite the existing page. After creation it publishes
# the page and prints the final public URL.
# ============================================================

set -e

if [ -z "$API_KEY" ]; then
  echo "ERROR: API_KEY environment variable is required."
  echo "Usage: API_KEY=appai_sk_YOUR_KEY bash scripts/create-kitchen-sink-page.sh"
  echo "Get a key at https://appai.info/dashboard/settings"
  exit 1
fi

API_BASE="${API_BASE:-https://appai.info}"
SLUG="qa-kitchen-sink"
UPSERT_URL="${API_BASE}/api/v1/pages?upsert=true"
PUBLISH_URL="${API_BASE}/api/v1/pages/${SLUG}/publish"
AUTH="Authorization: Bearer ${API_KEY}"
CT="Content-Type: application/json"

echo "Creating kitchen-sink QA page at ${API_BASE}/p/${SLUG}"
echo "Exercising all 18 section types with Lumen Labs demo content..."

PAYLOAD=$(cat <<'JSON'
{
  "slug": "qa-kitchen-sink",
  "title": "Lumen Labs — Kitchen Sink QA Page",
  "tagline": "Every section type, one page. The mobile QA baseline.",
  "metaTitle": "Lumen Labs — Kitchen Sink QA Page | AppAI Mobile Regression Baseline",
  "metaDescription": "Internal QA page used by the AppAI team to validate mobile rendering across every section type. Powered by Lumen Labs demo content.",
  "themeColor": "#4F46E5",
  "isPublished": true,
  "category": "PRODUCTIVITY",
  "content": {
    "logo": "https://placehold.co/512x512/4F46E5/white?text=Lumen",
    "sections": [
      {
        "type": "hero", "order": 1,
        "data": {
          "headline": "Lumen Labs — Cloud AI, Illuminated",
          "subheadline": "The workspace where product teams design, test, and ship AI features without babysitting infrastructure. Built for the era of agentic software.",
          "logo": "https://placehold.co/512x512/4F46E5/white?text=Lumen",
          "backgroundImage": "https://placehold.co/1920x1080/1E1B4B/ffffff?text=Lumen+Labs",
          "ctaText": "Start free trial",
          "ctaUrl": "#pricing"
        }
      },
      {
        "type": "about", "order": 2,
        "data": {
          "heading": "Why Lumen Labs",
          "text": "We started Lumen Labs in 2024 after watching too many great AI prototypes die on the way to production. The gap between a cool demo and a reliable feature is enormous, and most of it is plumbing: evals, versioning, prompt drift, cost controls, latency budgets.\n\nLumen is the **workspace that closes that gap**. Design prompts with your team, run evals on every change, deploy behind feature flags, and watch real usage roll in — all without touching a single YAML file. Our customers ship 3x faster and sleep 3x better."
        }
      },
      {
        "type": "video", "order": 3,
        "data": {
          "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          "caption": "Watch the 90-second product tour"
        }
      },
      {
        "type": "features", "order": 4,
        "data": {
          "items": [
            {"icon": "brain", "title": "Prompt Studio", "description": "Version, diff, and review prompts like code. Branch, merge, and roll back — your team will wonder how they ever lived without it."},
            {"icon": "zap", "title": "Instant Evals", "description": "Run regression suites on every prompt change. Catch quality drops before your users do, not after."},
            {"icon": "shield", "title": "Safety Rails", "description": "Built-in jailbreak detection, PII scrubbing, and content classifiers. Ship to regulated industries with confidence."},
            {"icon": "chart", "title": "Cost & Latency Tracking", "description": "Per-request telemetry broken down by prompt, model, and customer. Find the $4,000 prompt before it finds you."},
            {"icon": "globe", "title": "Multi-Model Router", "description": "Route between GPT, Claude, Gemini, and your own fine-tunes with a single config. Swap models without redeploying."},
            {"icon": "lock", "title": "SOC 2 & HIPAA Ready", "description": "Single tenant deployments, encryption at rest, and audit logs on everything. Enterprise from day one."}
          ]
        }
      },
      {
        "type": "screenshots", "order": 5,
        "data": {
          "images": [
            "https://placehold.co/1280x720/4F46E5/white?text=Prompt+Studio",
            "https://placehold.co/1280x720/6366F1/white?text=Eval+Dashboard",
            "https://placehold.co/1280x720/818CF8/white?text=Cost+Analytics",
            "https://placehold.co/1280x720/A5B4FC/1E1B4B?text=Model+Router",
            "https://placehold.co/1280x720/312E81/white?text=Safety+Rails"
          ]
        }
      },
      {
        "type": "stats", "order": 6,
        "data": {
          "items": [
            {"value": "3.1x", "label": "Faster shipping"},
            {"value": "42M", "label": "Requests / day"},
            {"value": "99.97%", "label": "Uptime SLA"},
            {"value": "180+", "label": "Teams onboard"}
          ]
        }
      },
      {
        "type": "gallery", "order": 7,
        "data": {
          "items": [
            {"url": "https://placehold.co/800x600/4F46E5/white?text=Case+Study+1", "caption": "Nimbus Health cut LLM spend 62%", "type": "image"},
            {"url": "https://placehold.co/800x600/6366F1/white?text=Case+Study+2", "caption": "Forge Legal shipped 4 AI features in Q1", "type": "image"},
            {"url": "https://placehold.co/800x600/818CF8/white?text=Case+Study+3", "caption": "Atlas EdTech reduced hallucinations 8x", "type": "image"},
            {"url": "https://placehold.co/800x600/A5B4FC/1E1B4B?text=Case+Study+4", "caption": "Kepler Finance moved 100% to multi-model", "type": "image"},
            {"url": "https://placehold.co/800x600/312E81/white?text=Case+Study+5", "caption": "Vela Travel automated tier-1 support", "type": "image"},
            {"url": "https://placehold.co/800x600/C7D2FE/1E1B4B?text=Case+Study+6", "caption": "Helix Bio accelerated literature review", "type": "image"},
            {"url": "https://placehold.co/800x600/4338CA/white?text=Case+Study+7", "caption": "Orbit Gaming built an in-game concierge", "type": "image"},
            {"url": "https://placehold.co/800x600/E0E7FF/1E1B4B?text=Case+Study+8", "caption": "Marble Retail personalized every PDP", "type": "image"}
          ]
        }
      },
      {
        "type": "pricing", "order": 8,
        "data": {
          "items": [
            {"name": "Starter", "price": "$0", "description": "For tinkerers and side projects", "features": ["1 workspace", "10,000 requests/month", "Community Discord", "Prompt Studio (1 branch)", "Basic evals"], "ctaText": "Start free", "ctaUrl": "#"},
            {"name": "Team", "price": "$199/mo", "description": "For product teams shipping AI features", "features": ["5 workspaces", "2M requests/month", "Unlimited prompt branches", "Full eval suite", "Cost & latency analytics", "Slack alerts", "Email support"], "highlighted": true, "ctaText": "Start 14-day trial", "ctaUrl": "#"},
            {"name": "Enterprise", "price": "Custom", "description": "For regulated & high-volume workloads", "features": ["Unlimited workspaces", "Volume pricing", "Single-tenant VPC", "SOC 2 + HIPAA", "SSO / SAML / SCIM", "Dedicated CSM", "24/7 on-call", "99.99% uptime SLA"], "ctaText": "Talk to sales", "ctaUrl": "#"}
          ]
        }
      },
      {
        "type": "testimonials", "order": 9,
        "data": {
          "items": [
            {"name": "Priya Raman", "role": "Head of AI, Nimbus Health", "avatar": "https://placehold.co/400x400/4F46E5/white?text=PR", "quote": "Lumen paid for itself in six weeks. We caught a prompt regression that would have misrouted 40,000 patient messages. That alone justified the contract."},
            {"name": "Dmitri Volkov", "role": "Staff Engineer, Kepler Finance", "avatar": "https://placehold.co/400x400/6366F1/white?text=DV", "quote": "I have never seen a team adopt a tool this fast. Within a month our prompts were versioned, evaluated, and on-call friendly. Total game changer."},
            {"name": "Amara Okafor", "role": "CPO, Atlas EdTech", "avatar": "https://placehold.co/400x400/818CF8/white?text=AO", "quote": "We went from launching one AI feature a quarter to launching one a month. The eval harness is worth the whole price tag."}
          ]
        }
      },
      {
        "type": "download", "order": 10,
        "data": {
          "appStoreUrl": "https://apps.apple.com/app/id0000000000",
          "playStoreUrl": "https://play.google.com/store/apps/details?id=com.lumenlabs.app",
          "ctaText": "Get the Lumen mobile companion"
        }
      },
      {
        "type": "team", "order": 11,
        "data": {
          "items": [
            {"name": "Elena Marquez", "role": "Co-founder & CEO", "photo": "https://placehold.co/400x400/4F46E5/white?text=EM", "bio": "Previously led platform at a top-tier LLM lab. Once shipped a prompt at 3 AM that took down a whole region. Never again."},
            {"name": "Tobias Lindqvist", "role": "Co-founder & CTO", "photo": "https://placehold.co/400x400/6366F1/white?text=TL", "bio": "Distributed systems nerd. Built evaluation pipelines for models you use every day. Believes evals are the new tests."},
            {"name": "Naomi Feldman", "role": "Head of Product", "photo": "https://placehold.co/400x400/818CF8/white?text=NF", "bio": "Shipped developer tools at three startups and one big co. Obsessed with the first 60 seconds of a product experience."},
            {"name": "Rahul Deshpande", "role": "Head of Research", "photo": "https://placehold.co/400x400/A5B4FC/1E1B4B?text=RD", "bio": "PhD in ML safety. Writes the papers everyone else cites. Keeps the company honest about what models can and cannot do."}
          ]
        }
      },
      {
        "type": "sponsors", "order": 12,
        "data": {
          "items": [
            {"name": "Nimbus Health", "logo": "https://placehold.co/240x120/ffffff/4F46E5?text=Nimbus", "url": "https://example.com/nimbus"},
            {"name": "Kepler Finance", "logo": "https://placehold.co/240x120/ffffff/4F46E5?text=Kepler", "url": "https://example.com/kepler"},
            {"name": "Atlas EdTech", "logo": "https://placehold.co/240x120/ffffff/4F46E5?text=Atlas", "url": "https://example.com/atlas"},
            {"name": "Forge Legal", "logo": "https://placehold.co/240x120/ffffff/4F46E5?text=Forge", "url": "https://example.com/forge"},
            {"name": "Vela Travel", "logo": "https://placehold.co/240x120/ffffff/4F46E5?text=Vela", "url": "https://example.com/vela"},
            {"name": "Helix Bio", "logo": "https://placehold.co/240x120/ffffff/4F46E5?text=Helix", "url": "https://example.com/helix"}
          ]
        }
      },
      {
        "type": "schedule", "order": 13,
        "data": {
          "items": [
            {"time": "Week 1", "title": "Kickoff & workspace setup", "speaker": "Your Lumen CSM", "description": "We provision your workspace, import existing prompts, and connect your model providers."},
            {"time": "Week 2", "title": "Eval harness onboarding", "speaker": "Solutions Engineer", "description": "Bring your test cases. We help you define golden sets and wire up regression checks for every prompt change."},
            {"time": "Week 3", "title": "Production rollout", "speaker": "Your team", "description": "Feature flag your first prompt through Lumen. We monitor together for the first 48 hours."},
            {"time": "Week 4", "title": "Cost & safety review", "speaker": "Lumen + your team", "description": "Walk through telemetry, find the top 3 cost wins, and tune safety rails for your domain."},
            {"time": "Ongoing", "title": "Quarterly business review", "speaker": "Your CSM", "description": "Review adoption, upcoming features, and roadmap requests."}
          ]
        }
      },
      {
        "type": "faq", "order": 14,
        "data": {
          "items": [
            {"question": "Which models does Lumen support?", "answer": "Everything popular — OpenAI, Anthropic, Google, Mistral, Cohere, Llama variants, and your own fine-tunes via a provider adapter. Adding a new provider takes roughly a day."},
            {"question": "Do you store our prompts or responses?", "answer": "By default we store prompts and a sampled subset of responses for evals and debugging. Enterprise customers can disable storage entirely or bring their own encryption keys."},
            {"question": "How is Lumen different from a prompt management library?", "answer": "Libraries give you version control. Lumen gives you version control, evaluation, safety, observability, and a UI your PMs and designers can actually use. It is a workspace, not a library."},
            {"question": "Can we self-host?", "answer": "Enterprise customers get a single-tenant VPC deployment in AWS, GCP, or Azure. Fully air-gapped installs are available on request."},
            {"question": "Do you have a free tier?", "answer": "Yes. The Starter plan gives you 10,000 requests per month and a single workspace, forever. No credit card required."},
            {"question": "How do you price requests?", "answer": "A request is a single call to a model through Lumen, regardless of model size. You are still billed separately by your model provider for tokens used."}
          ]
        }
      },
      {
        "type": "action", "order": 15,
        "data": {
          "heading": "Try it without signing up",
          "description": "These buttons hit our public demo endpoints. They are rate limited and safe to click — pure read-only calls.",
          "items": [
            {"label": "Ping demo API", "url": "https://example.com/api/demo/ping", "method": "GET", "style": "primary"},
            {"label": "Fetch sample eval", "url": "https://example.com/api/demo/eval", "method": "GET", "style": "secondary"},
            {"label": "Reset demo sandbox", "url": "https://example.com/api/demo/reset", "method": "POST", "confirmText": "This resets the public demo sandbox for everyone. Continue?", "style": "danger"}
          ]
        }
      },
      {
        "type": "links", "order": 16,
        "data": {
          "items": [
            {"title": "Website", "url": "https://example.com/lumen", "icon": "🌐", "style": "filled"},
            {"title": "Documentation", "url": "https://example.com/lumen/docs", "icon": "📖", "style": "filled"},
            {"title": "GitHub", "url": "https://github.com/lumen-labs", "icon": "💻", "style": "outlined"},
            {"title": "Changelog", "url": "https://example.com/lumen/changelog", "icon": "📝", "style": "outlined"},
            {"title": "Status page", "url": "https://example.com/lumen/status", "icon": "📊", "style": "outlined"},
            {"title": "Community Discord", "url": "https://example.com/lumen/discord", "icon": "💬", "style": "outlined"}
          ]
        }
      },
      {
        "type": "contact", "order": 17,
        "data": {
          "email": "hello@example.com",
          "phone": "+1-555-0186",
          "address": "548 Market St, San Francisco, CA 94104",
          "formUrl": "https://example.com/lumen/contact"
        }
      },
      {
        "type": "cta", "order": 18,
        "data": {
          "headline": "Ship AI features your team can actually trust",
          "subheadline": "Join 180+ teams already building on Lumen. Free to start, no credit card.",
          "buttonText": "Start free trial",
          "buttonUrl": "https://example.com/lumen/signup"
        }
      }
    ]
  },
  "privacyPolicy": "## Privacy Policy\n\nLast updated: 2026-04-09\n\nLumen Labs (fictional, for QA purposes) collects minimal account data — name, email, and usage telemetry — to operate the service. We do not sell personal data. Enterprise customers can request full data export or deletion at any time by emailing privacy@example.com.\n\nThis page exists only as an internal QA fixture for AppAI mobile regression testing. Do not treat this policy as legally binding.",
  "termsOfService": "## Terms of Service\n\nLast updated: 2026-04-09\n\nLumen Labs (fictional) is a QA fixture hosted on AppAI. By viewing this page you acknowledge it is demo content used to validate responsive rendering across 18 section types. No real service is being offered. For the real AppAI terms, see appai.info/terms."
}
JSON
)

echo "Upserting page..."
RESPONSE=$(curl -s -X POST "$UPSERT_URL" -H "$AUTH" -H "$CT" -d "$PAYLOAD")
echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ->', d.get('slug', d.get('error','unknown response')))" || {
  echo "ERROR: Unexpected response from upsert:"
  echo "$RESPONSE"
  exit 1
}

echo "Publishing page..."
PUB_RESPONSE=$(curl -s -X POST "$PUBLISH_URL" -H "$AUTH" -H "$CT")
echo "$PUB_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ->', 'published' if d.get('isPublished') else d.get('error','ok'))" || true

echo ""
echo "Done. Kitchen-sink QA page is live:"
echo "  ${API_BASE}/p/${SLUG}"
echo ""
echo "Use this URL as the mobile regression baseline at 375 / 768 / 1440 px."
