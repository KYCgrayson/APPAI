#!/bin/bash
# Create 6 demo pages for README template showcase
# Usage: API_KEY=appai_sk_xxx bash scripts/create-demo-pages.sh

API="https://appai.info/api/v1/pages"
AUTH="Authorization: Bearer $API_KEY"
CT="Content-Type: application/json"

if [ -z "$API_KEY" ]; then
  echo "Usage: API_KEY=appai_sk_xxx bash scripts/create-demo-pages.sh"
  exit 1
fi

echo "=== 1/6 App Landing Page ==="
curl -s -X POST "$API" -H "$AUTH" -H "$CT" -d '{
  "slug": "demo-app-landing",
  "title": "AppAI",
  "tagline": "Free hosting for AI-built apps",
  "themeColor": "#2563EB",
  "isPublished": true,
  "category": "PRODUCTIVITY",
  "content": {
    "logo": "https://appai.info/appai-logo2.png",
    "sections": [
      {
        "type": "hero", "order": 1,
        "data": {
          "headline": "Your AI App deserves a home on the web",
          "subheadline": "Get a free landing page, privacy policy, and terms of service. No domain needed. Let your AI Agent set it up in 30 seconds.",
          "logo": "https://appai.info/appai-logo2.png",
          "ctaText": "Get Started Free",
          "ctaUrl": "https://appai.info/dashboard"
        }
      },
      {
        "type": "features", "order": 2,
        "data": {
          "items": [
            {"icon": "rocket", "title": "30-Second Setup", "description": "Tell your AI agent to create a page. It reads the spec and handles everything automatically."},
            {"icon": "globe", "title": "Instant Hosting", "description": "Your page goes live at appai.info/p/your-app. No domain or deployment needed."},
            {"icon": "shield", "title": "Legal Docs Included", "description": "Auto-generated privacy policy and terms of service, ready for App Store submission."},
            {"icon": "code", "title": "AI Agent API", "description": "RFC 8628 device auth flow. Claude, GPT, Codex — any agent can create pages."},
            {"icon": "heart", "title": "Multi-Language", "description": "30+ locales supported. Auto-detect browser language, hreflang for SEO."},
            {"icon": "zap", "title": "Free Forever", "description": "3 pages per account, unlimited locale variants. No credit card required."}
          ]
        }
      },
      {
        "type": "stats", "order": 3,
        "data": {
          "items": [
            {"value": "18", "label": "Section Types"},
            {"value": "6", "label": "Preset Templates"},
            {"value": "30+", "label": "Languages"},
            {"value": "Free", "label": "Forever"}
          ]
        }
      },
      {
        "type": "faq", "order": 4,
        "data": {
          "items": [
            {"question": "How do I create a page?", "answer": "Tell your AI agent (Claude, GPT, Codex, Cursor) to read the spec at appai.info/spec. It will authenticate, ask you questions, and create your page automatically."},
            {"question": "Is it really free?", "answer": "Yes. You get 3 pages (slugs) for free, each with unlimited language versions. No credit card needed."},
            {"question": "Can I use my own domain?", "answer": "Not yet — pages are hosted at appai.info/p/your-slug. Custom domains are on the roadmap."},
            {"question": "What AI agents are supported?", "answer": "Any agent that can make HTTP requests. Claude, GPT, Codex, Cursor, and more. The spec is designed to be readable by any LLM."}
          ]
        }
      },
      {
        "type": "cta", "order": 5,
        "data": {
          "headline": "Ready to launch?",
          "subheadline": "Give your AI-built app the web presence it deserves.",
          "buttonText": "Get Started Free",
          "buttonUrl": "https://appai.info/dashboard"
        }
      }
    ]
  },
  "privacyPolicy": "## Privacy Policy\n\nLast updated: 2026-03-19\n\nAppAI is committed to protecting your privacy. We collect minimal data (Google account info for authentication) and do not sell your information.",
  "termsOfService": "## Terms of Service\n\nLast updated: 2026-03-19\n\nBy using AppAI, you agree to use the platform responsibly. Pages must not contain illegal or harmful content."
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug', d.get('error','???')))"

echo "=== 2/6 SaaS Landing Page ==="
curl -s -X POST "$API" -H "$AUTH" -H "$CT" -d '{
  "slug": "demo-saas",
  "title": "CodePilot AI",
  "tagline": "AI-powered code review for your team",
  "themeColor": "#7C3AED",
  "isPublished": true,
  "category": "CODING",
  "content": {
    "sections": [
      {
        "type": "hero", "order": 1,
        "data": {
          "headline": "Ship better code, faster",
          "subheadline": "CodePilot AI reviews every pull request in seconds. Catch bugs, enforce style, and learn best practices — powered by GPT-4.",
          "ctaText": "Start Free Trial",
          "ctaUrl": "#pricing"
        }
      },
      {
        "type": "features", "order": 2,
        "data": {
          "items": [
            {"icon": "brain", "title": "AI Code Review", "description": "Understands context, not just syntax. Catches logic bugs that linters miss."},
            {"icon": "zap", "title": "Instant Feedback", "description": "Reviews appear as PR comments within 30 seconds of push."},
            {"icon": "lock", "title": "Secure by Design", "description": "Your code never leaves your infrastructure. Self-hosted option available."},
            {"icon": "chart", "title": "Team Analytics", "description": "Track code quality trends, review coverage, and team velocity."},
            {"icon": "globe", "title": "All Languages", "description": "TypeScript, Python, Go, Rust, Java, and 20+ more languages supported."},
            {"icon": "star", "title": "Custom Rules", "description": "Define your own review rules and coding standards. AI enforces them consistently."}
          ]
        }
      },
      {
        "type": "pricing", "order": 3,
        "data": {
          "items": [
            {"name": "Starter", "price": "$0", "description": "For solo developers", "features": ["1 repository", "50 reviews/month", "Basic analysis", "GitHub integration"], "ctaText": "Get Started", "ctaUrl": "#"},
            {"name": "Team", "price": "$29/mo", "description": "For growing teams", "features": ["10 repositories", "Unlimited reviews", "Advanced analysis", "GitHub + GitLab", "Custom rules", "Slack notifications"], "highlighted": true, "ctaText": "Start Trial", "ctaUrl": "#"},
            {"name": "Enterprise", "price": "Custom", "description": "For large organizations", "features": ["Unlimited repositories", "Self-hosted option", "SSO / SAML", "Dedicated support", "SLA guarantee", "Custom integrations"], "ctaText": "Contact Sales", "ctaUrl": "#"}
          ]
        }
      },
      {
        "type": "testimonials", "order": 4,
        "data": {
          "items": [
            {"name": "Sarah Chen", "role": "CTO at Startup", "quote": "CodePilot caught a race condition that three senior engineers missed. Paid for itself in the first week."},
            {"name": "Marcus Johnson", "role": "Lead Developer", "quote": "Our PR review time dropped from 2 days to 2 hours. The AI suggestions are surprisingly good."},
            {"name": "Yuki Tanaka", "role": "Engineering Manager", "quote": "We use it to onboard junior developers. They learn best practices from every review."}
          ]
        }
      },
      {
        "type": "faq", "order": 5,
        "data": {
          "items": [
            {"question": "Is my code sent to OpenAI?", "answer": "By default, code is processed through our secure API. Enterprise customers can self-host for full data isolation."},
            {"question": "Does it replace human code review?", "answer": "No — it augments your team. AI handles the routine checks so humans can focus on architecture and design decisions."}
          ]
        }
      },
      {
        "type": "cta", "order": 6,
        "data": {
          "headline": "Better code starts today",
          "subheadline": "Join 2,000+ teams shipping with confidence.",
          "buttonText": "Start Free Trial",
          "buttonUrl": "#"
        }
      }
    ]
  },
  "privacyPolicy": "## Privacy Policy\n\nLast updated: 2026-03-19\n\nCodePilot AI processes code only for review purposes. We do not store your source code after analysis is complete.",
  "termsOfService": "## Terms of Service\n\nLast updated: 2026-03-19\n\nBy using CodePilot AI, you agree to use the service for legitimate code review purposes only."
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug', d.get('error','???')))"

echo "=== 3/6 Personal Profile ==="
curl -s -X POST "$API" -H "$AUTH" -H "$CT" -d '{
  "slug": "demo-profile",
  "title": "Grayson K.",
  "tagline": "Builder, developer, creator of AppAI",
  "themeColor": "#0EA5E9",
  "isPublished": true,
  "category": "OTHER",
  "content": {
    "sections": [
      {
        "type": "hero", "order": 1,
        "data": {
          "headline": "Grayson K.",
          "subheadline": "Full-stack developer & AI enthusiast. Building tools that let AI agents create things for humans.",
          "ctaText": "View Projects",
          "ctaUrl": "#links"
        }
      },
      {
        "type": "about", "order": 2,
        "data": {
          "heading": "About Me",
          "text": "I build products at the intersection of AI and web development. My current focus is **AppAI** — a platform where AI agents can autonomously create and host landing pages.\n\nI believe the future of software is AI-assisted creation. Instead of spending hours on boilerplate, developers should focus on what makes their product unique. That is what drives everything I build."
        }
      },
      {
        "type": "stats", "order": 3,
        "data": {
          "items": [
            {"value": "5+", "label": "Years Coding"},
            {"value": "3", "label": "Products Shipped"},
            {"value": "Open Source", "label": "Philosophy"},
            {"value": "AI-First", "label": "Approach"}
          ]
        }
      },
      {
        "type": "links", "order": 4,
        "data": {
          "items": [
            {"title": "AppAI — AI App Hosting", "url": "https://appai.info", "icon": "🚀", "style": "filled"},
            {"title": "MedLogAI — Medical Logging", "url": "https://appai.info/p/medlogai", "icon": "🏥", "style": "filled"},
            {"title": "GitHub", "url": "https://github.com/KYCgrayson", "icon": "💻", "style": "outlined"},
            {"title": "LinkedIn", "url": "https://linkedin.com", "icon": "💼", "style": "outlined"}
          ]
        }
      },
      {
        "type": "contact", "order": 5,
        "data": {
          "email": "hello@appai.info"
        }
      }
    ]
  }
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug', d.get('error','???')))"

echo "=== 4/6 Link in Bio ==="
curl -s -X POST "$API" -H "$AUTH" -H "$CT" -d '{
  "slug": "demo-links",
  "title": "AppAI Links",
  "tagline": "All our links in one place",
  "themeColor": "#F59E0B",
  "isPublished": true,
  "category": "OTHER",
  "content": {
    "sections": [
      {
        "type": "hero", "order": 1,
        "data": {
          "headline": "AppAI",
          "subheadline": "Free hosting for AI-built apps. Follow us everywhere.",
          "logo": "https://appai.info/appai-logo2.png"
        }
      },
      {
        "type": "links", "order": 2,
        "data": {
          "items": [
            {"title": "🌐 Website — appai.info", "url": "https://appai.info", "style": "filled"},
            {"title": "📖 Agent Spec — Build with AI", "url": "https://appai.info/spec", "style": "filled"},
            {"title": "💻 GitHub — Open Source", "url": "https://github.com/KYCgrayson/APPAI", "style": "outlined"},
            {"title": "📱 Browse Apps", "url": "https://appai.info/apps", "style": "outlined"},
            {"title": "🔑 Dashboard — Manage Your Pages", "url": "https://appai.info/dashboard", "style": "outlined"},
            {"title": "📄 LLM Info (llms.txt)", "url": "https://appai.info/llms.txt", "style": "outlined"}
          ]
        }
      }
    ]
  }
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug', d.get('error','???')))"

echo "=== 5/6 Portfolio ==="
curl -s -X POST "$API" -H "$AUTH" -H "$CT" -d '{
  "slug": "demo-portfolio",
  "title": "Pixel Studio",
  "tagline": "Design & development studio",
  "themeColor": "#EC4899",
  "isPublished": true,
  "category": "DESIGN",
  "content": {
    "sections": [
      {
        "type": "hero", "order": 1,
        "data": {
          "headline": "We craft digital experiences",
          "subheadline": "Pixel Studio is a design & development studio specializing in AI-powered products, mobile apps, and brand identity.",
          "ctaText": "View Our Work",
          "ctaUrl": "#gallery"
        }
      },
      {
        "type": "about", "order": 2,
        "data": {
          "heading": "Our Philosophy",
          "text": "Great design is invisible. We believe in **simplicity**, **clarity**, and **purpose**. Every pixel serves a function. Every interaction tells a story.\n\nWe have worked with startups and Fortune 500 companies to ship products that users love. From concept to launch, we handle design, development, and everything in between."
        }
      },
      {
        "type": "stats", "order": 3,
        "data": {
          "items": [
            {"value": "50+", "label": "Projects Delivered"},
            {"value": "12", "label": "Countries"},
            {"value": "98%", "label": "Client Satisfaction"},
            {"value": "2019", "label": "Founded"}
          ]
        }
      },
      {
        "type": "testimonials", "order": 4,
        "data": {
          "items": [
            {"name": "Alex Rivera", "role": "Founder, NeoFinance", "quote": "Pixel Studio transformed our banking app. Conversion rate went up 40% after the redesign."},
            {"name": "Emma Liu", "role": "Product Lead, HealthTech", "quote": "They understood our vision from day one. The final product exceeded all expectations."},
            {"name": "David Kim", "role": "CEO, EduLearn", "quote": "Fast, professional, and incredibly creative. Would recommend to any startup."}
          ]
        }
      },
      {
        "type": "contact", "order": 5,
        "data": {
          "email": "hello@pixelstudio.design",
          "address": "San Francisco, CA"
        }
      }
    ]
  },
  "privacyPolicy": "## Privacy Policy\n\nLast updated: 2026-03-19\n\nPixel Studio respects your privacy. We collect contact information only when you reach out to us.",
  "termsOfService": "## Terms of Service\n\nLast updated: 2026-03-19\n\nAll design work is subject to our standard service agreement."
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug', d.get('error','???')))"

echo "=== 6/6 Event Page ==="
curl -s -X POST "$API" -H "$AUTH" -H "$CT" -d '{
  "slug": "demo-event",
  "title": "AI Builder Summit 2026",
  "tagline": "The conference for developers building with AI",
  "themeColor": "#DC2626",
  "isPublished": true,
  "category": "EDUCATION",
  "content": {
    "sections": [
      {
        "type": "hero", "order": 1,
        "data": {
          "headline": "AI Builder Summit 2026",
          "subheadline": "June 15-16, San Francisco. Two days of talks, workshops, and networking for developers building the AI-powered future.",
          "ctaText": "Get Tickets",
          "ctaUrl": "#pricing"
        }
      },
      {
        "type": "about", "order": 2,
        "data": {
          "heading": "About the Event",
          "text": "AI Builder Summit brings together **500+ developers, founders, and researchers** who are building real products with AI. No hype — just practical talks, live coding, and honest conversations about what works.\n\nWhether you are shipping AI agents, fine-tuning models, or building AI-native UIs — this is your tribe."
        }
      },
      {
        "type": "schedule", "order": 3,
        "data": {
          "items": [
            {"time": "Day 1 — 9:00 AM", "title": "Opening Keynote: The Agent Era", "speaker": "Dr. Sarah Lin", "description": "How autonomous AI agents are reshaping software development."},
            {"time": "Day 1 — 10:30 AM", "title": "Workshop: Build an AI Agent in 30 Minutes", "speaker": "Grayson K.", "description": "Hands-on session using AppAI to create and deploy AI-powered pages."},
            {"time": "Day 1 — 2:00 PM", "title": "Panel: Shipping AI Products That Users Love", "speaker": "Multiple Speakers", "description": "Product leaders share lessons from building AI-first products."},
            {"time": "Day 2 — 9:00 AM", "title": "Fine-Tuning for Production", "speaker": "James Park", "description": "Practical guide to fine-tuning models for real-world applications."},
            {"time": "Day 2 — 11:00 AM", "title": "Live Build: From Idea to Deployed App", "speaker": "Community", "description": "Watch teams build and ship AI apps live on stage."},
            {"time": "Day 2 — 4:00 PM", "title": "Closing: What is Next for AI Development", "speaker": "All Speakers", "description": "Roundtable discussion and community Q&A."}
          ]
        }
      },
      {
        "type": "team", "order": 4,
        "data": {
          "items": [
            {"name": "Dr. Sarah Lin", "role": "AI Research Lead, DeepMind", "bio": "Leading research on autonomous agents and multi-modal AI systems."},
            {"name": "Grayson K.", "role": "Creator of AppAI", "bio": "Building the platform where AI agents host apps. Open source enthusiast."},
            {"name": "James Park", "role": "ML Engineer, Anthropic", "bio": "Specializes in production ML systems and model optimization."},
            {"name": "Maria Gonzalez", "role": "Product Lead, Vercel", "bio": "Shipping developer tools used by millions. AI-native product design."}
          ]
        }
      },
      {
        "type": "pricing", "order": 5,
        "data": {
          "items": [
            {"name": "Early Bird", "price": "$199", "description": "Limited availability", "features": ["All sessions", "Workshop access", "Lunch included", "Community Slack"], "ctaText": "Buy Now", "ctaUrl": "#"},
            {"name": "Regular", "price": "$349", "description": "Standard admission", "features": ["All sessions", "Workshop access", "Lunch included", "Community Slack", "Recording access"], "highlighted": true, "ctaText": "Buy Now", "ctaUrl": "#"},
            {"name": "VIP", "price": "$599", "description": "Premium experience", "features": ["All sessions", "Workshop access", "Lunch + dinner", "Community Slack", "Recording access", "Speaker dinner", "1-on-1 mentoring"], "ctaText": "Buy Now", "ctaUrl": "#"}
          ]
        }
      },
      {
        "type": "faq", "order": 6,
        "data": {
          "items": [
            {"question": "Where is it held?", "answer": "Moscone Center, San Francisco, CA. June 15-16, 2026."},
            {"question": "Can I get a refund?", "answer": "Full refund up to 30 days before the event. 50% refund up to 7 days before."},
            {"question": "Is there a virtual option?", "answer": "Yes — all talks will be livestreamed. Recording access is included with Regular and VIP tickets."},
            {"question": "Do I need to know AI/ML?", "answer": "Basic programming knowledge is enough. Workshops are beginner-friendly."}
          ]
        }
      },
      {
        "type": "cta", "order": 7,
        "data": {
          "headline": "Join 500+ builders",
          "subheadline": "Early bird pricing ends May 1. Do not miss out.",
          "buttonText": "Get Your Ticket",
          "buttonUrl": "#pricing"
        }
      }
    ]
  },
  "privacyPolicy": "## Privacy Policy\n\nLast updated: 2026-03-19\n\nAI Builder Summit collects registration information solely for event management. We do not share your data with third parties.",
  "termsOfService": "## Terms of Service\n\nLast updated: 2026-03-19\n\nBy purchasing a ticket, you agree to the event code of conduct and refund policy."
}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug', d.get('error','???')))"

echo ""
echo "Done! Demo pages:"
echo "  1. appai.info/p/demo-app-landing  (App Landing)"
echo "  2. appai.info/p/demo-saas         (SaaS Landing)"
echo "  3. appai.info/p/demo-profile      (Personal Profile — your profile!)"
echo "  4. appai.info/p/demo-links        (Link in Bio — AppAI links)"
echo "  5. appai.info/p/demo-portfolio    (Portfolio)"
echo "  6. appai.info/p/demo-event        (Event — AI Builder Summit)"
