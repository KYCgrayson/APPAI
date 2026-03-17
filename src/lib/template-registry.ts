// ============================================================
// AppAI Template Registry
// Defines all available sections (building blocks) and presets
// ============================================================

// --- Section Field Definitions ---

export interface SectionFieldDef {
  name: string;
  type: "string" | "url" | "markdown" | "boolean" | "number" | "array" | "object";
  required: boolean;
  description: string;
  items?: SectionFieldDef[];  // for array types
  fields?: SectionFieldDef[]; // for object types
}

export interface SectionDef {
  type: string;
  name: string;
  description: string;
  fields: SectionFieldDef[];
}

export interface PresetDef {
  id: string;
  name: string;
  description: string;
  sections: string[]; // section types in default order
}

// --- All Available Sections ---

export const SECTION_DEFS: SectionDef[] = [
  {
    type: "hero",
    name: "Hero",
    description: "Large headline banner with optional background image/video, logo, and call-to-action button. Usually the first section of any page.",
    fields: [
      { name: "headline", type: "string", required: true, description: "Main headline text" },
      { name: "subheadline", type: "string", required: false, description: "Supporting text below headline" },
      { name: "logo", type: "url", required: false, description: "Logo image URL, displayed top-left" },
      { name: "backgroundImage", type: "url", required: false, description: "Background image URL (static)" },
      { name: "backgroundVideo", type: "url", required: false, description: "Background video URL (mp4/webm, autoplays muted)" },
      { name: "ctaText", type: "string", required: false, description: "Call-to-action button text" },
      { name: "ctaUrl", type: "url", required: false, description: "Call-to-action button link" },
    ],
  },
  {
    type: "video",
    name: "Video",
    description: "Embedded video section. Supports YouTube, Vimeo, mp4/webm files, and GIFs. Auto-detects format.",
    fields: [
      { name: "url", type: "url", required: true, description: "Video URL (YouTube/Vimeo link, .mp4, .webm, or .gif)" },
      { name: "caption", type: "string", required: false, description: "Caption text below the video" },
    ],
  },
  {
    type: "features",
    name: "Features",
    description: "Feature list displayed in a 3-column grid with icons.",
    fields: [
      {
        name: "items", type: "array", required: true, description: "List of features",
        items: [
          { name: "icon", type: "string", required: false, description: "Icon name (brain, zap, shield, star, heart, globe, lock, rocket, code, chart) or any emoji" },
          { name: "title", type: "string", required: true, description: "Feature title" },
          { name: "description", type: "string", required: true, description: "Feature description" },
        ],
      },
    ],
  },
  {
    type: "screenshots",
    name: "Screenshots",
    description: "Horizontal scrollable image carousel for app screenshots or product images.",
    fields: [
      {
        name: "images", type: "array", required: true, description: "List of screenshot image URLs",
        items: [
          { name: "url", type: "url", required: true, description: "Image URL" },
        ],
      },
    ],
  },
  {
    type: "download",
    name: "Download",
    description: "App download buttons for App Store and Google Play.",
    fields: [
      { name: "appStoreUrl", type: "url", required: false, description: "Apple App Store URL" },
      { name: "playStoreUrl", type: "url", required: false, description: "Google Play Store URL" },
      { name: "ctaText", type: "string", required: false, description: "Headline text (default: 'Download Now')" },
    ],
  },
  {
    type: "pricing",
    name: "Pricing",
    description: "Pricing plan comparison cards.",
    fields: [
      {
        name: "items", type: "array", required: true, description: "List of pricing plans",
        items: [
          { name: "name", type: "string", required: true, description: "Plan name (e.g. 'Free', 'Pro')" },
          { name: "price", type: "string", required: true, description: "Price display (e.g. '$0', '$9/mo')" },
          { name: "description", type: "string", required: false, description: "Short plan description" },
          { name: "features", type: "array", required: true, description: "List of feature strings included in this plan" },
          { name: "highlighted", type: "boolean", required: false, description: "Whether this plan is recommended (highlighted)" },
          { name: "ctaText", type: "string", required: false, description: "Button text (default: 'Get Started')" },
          { name: "ctaUrl", type: "url", required: false, description: "Button link" },
        ],
      },
    ],
  },
  {
    type: "testimonials",
    name: "Testimonials",
    description: "User testimonial/review cards.",
    fields: [
      {
        name: "items", type: "array", required: true, description: "List of testimonials",
        items: [
          { name: "name", type: "string", required: true, description: "Person's name" },
          { name: "role", type: "string", required: false, description: "Role or title (e.g. 'CEO at Company')" },
          { name: "avatar", type: "url", required: false, description: "Avatar image URL" },
          { name: "quote", type: "string", required: true, description: "Testimonial text" },
        ],
      },
    ],
  },
  {
    type: "faq",
    name: "FAQ",
    description: "Frequently asked questions with expandable answers.",
    fields: [
      {
        name: "items", type: "array", required: true, description: "List of Q&A pairs",
        items: [
          { name: "question", type: "string", required: true, description: "Question text" },
          { name: "answer", type: "string", required: true, description: "Answer text" },
        ],
      },
    ],
  },
  {
    type: "gallery",
    name: "Gallery",
    description: "Image/video gallery grid for showcasing work, products, or portfolio items.",
    fields: [
      {
        name: "items", type: "array", required: true, description: "List of gallery items",
        items: [
          { name: "url", type: "url", required: true, description: "Image or video URL" },
          { name: "caption", type: "string", required: false, description: "Caption text" },
          { name: "type", type: "string", required: false, description: "'image' or 'video' (default: 'image')" },
        ],
      },
    ],
  },
  {
    type: "team",
    name: "Team",
    description: "Team member cards with photo, name, role, and bio.",
    fields: [
      {
        name: "items", type: "array", required: true, description: "List of team members",
        items: [
          { name: "name", type: "string", required: true, description: "Member name" },
          { name: "role", type: "string", required: true, description: "Job title or role" },
          { name: "photo", type: "url", required: false, description: "Photo URL" },
          { name: "bio", type: "string", required: false, description: "Short bio" },
        ],
      },
    ],
  },
  {
    type: "schedule",
    name: "Schedule",
    description: "Timeline or agenda for events, conferences, or launches.",
    fields: [
      {
        name: "items", type: "array", required: true, description: "List of schedule entries",
        items: [
          { name: "time", type: "string", required: true, description: "Time slot (e.g. '10:00 AM', 'Day 1')" },
          { name: "title", type: "string", required: true, description: "Session title" },
          { name: "description", type: "string", required: false, description: "Session description" },
          { name: "speaker", type: "string", required: false, description: "Speaker name" },
        ],
      },
    ],
  },
  {
    type: "sponsors",
    name: "Sponsors / Partners",
    description: "Logo wall for sponsors, partners, or integrations.",
    fields: [
      {
        name: "items", type: "array", required: true, description: "List of sponsors/partners",
        items: [
          { name: "name", type: "string", required: true, description: "Company name" },
          { name: "logo", type: "url", required: true, description: "Logo image URL" },
          { name: "url", type: "url", required: false, description: "Website URL" },
        ],
      },
    ],
  },
  {
    type: "stats",
    name: "Stats",
    description: "Key metrics or numbers displayed prominently (e.g. '10K+ Users', '99.9% Uptime').",
    fields: [
      {
        name: "items", type: "array", required: true, description: "List of stats",
        items: [
          { name: "value", type: "string", required: true, description: "Stat value (e.g. '10K+', '99.9%')" },
          { name: "label", type: "string", required: true, description: "Stat label (e.g. 'Users', 'Uptime')" },
        ],
      },
    ],
  },
  {
    type: "contact",
    name: "Contact",
    description: "Contact information section with email, phone, and address.",
    fields: [
      { name: "email", type: "string", required: false, description: "Contact email" },
      { name: "phone", type: "string", required: false, description: "Phone number" },
      { name: "address", type: "string", required: false, description: "Physical address" },
      { name: "formUrl", type: "url", required: false, description: "External form URL (e.g. Google Forms, Typeform)" },
    ],
  },
  {
    type: "cta",
    name: "Call to Action",
    description: "Bold call-to-action banner. Usually placed at the bottom of the page.",
    fields: [
      { name: "headline", type: "string", required: true, description: "CTA headline" },
      { name: "subheadline", type: "string", required: false, description: "Supporting text" },
      { name: "buttonText", type: "string", required: true, description: "Button label" },
      { name: "buttonUrl", type: "url", required: true, description: "Button link" },
    ],
  },
  {
    type: "links",
    name: "Links",
    description: "List of link buttons (Linktree-style). Best for link-in-bio pages.",
    fields: [
      {
        name: "items", type: "array", required: true, description: "List of links",
        items: [
          { name: "title", type: "string", required: true, description: "Link text" },
          { name: "url", type: "url", required: true, description: "Link URL" },
          { name: "icon", type: "string", required: false, description: "Emoji or icon" },
          { name: "style", type: "string", required: false, description: "'filled' or 'outlined' (default: 'outlined')" },
        ],
      },
    ],
  },
  {
    type: "about",
    name: "About",
    description: "Text content section for descriptions, introductions, or stories. Supports Markdown.",
    fields: [
      { name: "heading", type: "string", required: false, description: "Section heading (default: 'About')" },
      { name: "text", type: "markdown", required: true, description: "Content text in Markdown format" },
    ],
  },
  {
    type: "action",
    name: "Action Buttons",
    description: "Interactive buttons that send HTTP requests to custom URLs. Use for webhooks, API triggers, admin tools, or test panels. Each button displays the response after execution.",
    fields: [
      { name: "heading", type: "string", required: false, description: "Section heading" },
      { name: "description", type: "string", required: false, description: "Description text" },
      {
        name: "items", type: "array", required: true, description: "List of action buttons",
        items: [
          { name: "label", type: "string", required: true, description: "Button text" },
          { name: "url", type: "url", required: true, description: "Target URL to send request to" },
          { name: "method", type: "string", required: false, description: "HTTP method (default: 'POST')" },
          { name: "headers", type: "object", required: false, description: "Custom HTTP headers (e.g. Authorization)" },
          { name: "body", type: "object", required: false, description: "JSON request body" },
          { name: "confirmText", type: "string", required: false, description: "Confirmation dialog text (skipped if empty)" },
          { name: "style", type: "string", required: false, description: "'primary' (filled), 'secondary' (outlined), or 'danger' (red)" },
        ],
      },
    ],
  },
];

// --- Presets (template shortcuts) ---

export const PRESET_DEFS: PresetDef[] = [
  {
    id: "app-landing",
    name: "App Landing Page",
    description: "For iOS/Android apps. Includes hero with logo, product video, features, screenshots, download buttons, testimonials, FAQ, and call-to-action.",
    sections: ["hero", "video", "features", "screenshots", "download", "testimonials", "faq", "cta"],
  },
  {
    id: "saas-landing",
    name: "SaaS Landing Page",
    description: "For web tools, APIs, and SaaS products. Includes hero, product video, features, pricing plans, testimonials, FAQ, and call-to-action.",
    sections: ["hero", "video", "features", "pricing", "testimonials", "faq", "cta"],
  },
  {
    id: "profile",
    name: "Personal Profile",
    description: "For personal branding. Includes hero, about section, key stats, contact info, and social links.",
    sections: ["hero", "about", "stats", "contact", "links"],
  },
  {
    id: "link-in-bio",
    name: "Link in Bio",
    description: "Minimal link aggregator page (like Linktree). Just a hero with avatar and a list of link buttons.",
    sections: ["hero", "links"],
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description: "For showcasing creative work. Includes hero, about section, gallery, testimonials, and contact.",
    sections: ["hero", "about", "gallery", "testimonials", "contact"],
  },
  {
    id: "event",
    name: "Event Page",
    description: "For conferences, meetups, and launches. Includes hero, about, video, schedule, team (speakers), pricing (tickets), sponsors, FAQ, and call-to-action.",
    sections: ["hero", "about", "video", "schedule", "team", "pricing", "sponsors", "faq", "cta"],
  },
];

// --- Lookup helpers ---

export function getSectionDef(type: string): SectionDef | undefined {
  return SECTION_DEFS.find((s) => s.type === type);
}

export function getPresetDef(id: string): PresetDef | undefined {
  return PRESET_DEFS.find((p) => p.id === id);
}
