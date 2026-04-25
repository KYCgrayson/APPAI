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

/** Common fields available on every section. Injected automatically by the /api/v1/sections endpoint. */
export const COMMON_SECTION_FIELDS: SectionFieldDef[] = [
  {
    name: "id",
    type: "string",
    required: false,
    description: "Optional anchor id for in-page linking (e.g. \"pricing\" to enable #pricing). Must be a valid HTML id — lowercase, no spaces.",
  },
  {
    name: "backgroundColor",
    type: "string",
    required: false,
    description: "CSS color for the section background (e.g. \"#EEF2FF\", \"#1E293B\"). Use tints of your themeColor for visual rhythm. If omitted, sections alternate between white and light gray.",
  },
];

/** @deprecated Use COMMON_SECTION_FIELDS instead. Kept for backward compatibility. */
export const COMMON_SECTION_FIELD: SectionFieldDef = COMMON_SECTION_FIELDS[0];

export interface SectionDef {
  type: string;
  name: string;
  description: string;
  /** Section-specific fields. The common `id` field is added automatically by the /api/v1/sections endpoint. */
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
    description: "Large headline banner with optional background image/video, logo, and call-to-action button. Supports three layout variants: 'centered' (default), 'split' (text left, image right), and 'minimal' (compact, no min-height). Usually the first section of any page.",
    fields: [
      { name: "headline", type: "string", required: true, description: "Main headline text" },
      { name: "subheadline", type: "string", required: false, description: "Supporting text below headline" },
      { name: "logo", type: "url", required: false, description: "Logo image URL, displayed top-left" },
      { name: "backgroundImage", type: "url", required: false, description: "Background image URL. In 'centered' variant: full-bleed background. In 'split' variant: displayed as the right-side image." },
      { name: "backgroundVideo", type: "url", required: false, description: "Background video URL (mp4/webm, autoplays muted). Only used in 'centered' variant." },
      { name: "ctaText", type: "string", required: false, description: "Primary call-to-action button text" },
      { name: "ctaUrl", type: "url", required: false, description: "Primary call-to-action button link" },
      { name: "ctaSecondaryText", type: "string", required: false, description: "Secondary CTA button text (outlined style, uses themeColorSecondary)" },
      { name: "ctaSecondaryUrl", type: "url", required: false, description: "Secondary CTA button link" },
      { name: "variant", type: "string", required: false, description: "Layout variant: 'centered' (default, full-width with centered text), 'split' (text left, image right — great for product pages), 'minimal' (compact, padding-only unless heroHeight is set)" },
      { name: "heroHeight", type: "string", required: false, description: "Hero height: 'full' (100vh), 'large' (70vh, default), 'medium' (50vh), 'small' (35vh). Controls the minimum height of the hero section." },
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
          { name: "description", type: "markdown", required: false, description: "Short plan description (Markdown supported)" },
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
          { name: "quote", type: "markdown", required: true, description: "Testimonial text (Markdown supported)" },
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
          { name: "answer", type: "markdown", required: true, description: "Answer text (Markdown supported)" },
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
          { name: "bio", type: "markdown", required: false, description: "Short bio (Markdown supported)" },
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
          { name: "description", type: "markdown", required: false, description: "Session description (Markdown supported)" },
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
      { name: "subheadline", type: "markdown", required: false, description: "Supporting text (Markdown supported)" },
      { name: "buttonText", type: "string", required: true, description: "Button label" },
      { name: "buttonUrl", type: "url", required: true, description: "Button link" },
      { name: "rel", type: "string", required: false, description: "Optional link rel attribute. Use 'nofollow' for affiliate/sponsored/user-supplied links, 'sponsored' for paid placements. Default is standard dofollow." },
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
          { name: "rel", type: "string", required: false, description: "Optional link rel attribute. Use 'nofollow' for affiliate/sponsored/user-supplied links, 'sponsored' for paid placements. Default is standard dofollow." },
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
      { name: "description", type: "markdown", required: false, description: "Description text (Markdown supported)" },
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
  {
    type: "media-downloader",
    name: "Media Downloader",
    description: "Interactive media download tool. Users paste a URL from YouTube, Instagram, TikTok, Twitter, or 1000+ platforms, choose format (video/MP3) and quality, then download the file. Requires a backend API endpoint.",
    fields: [
      { name: "heading", type: "string", required: false, description: "Section heading (e.g. 'Media Downloader')" },
      { name: "description", type: "string", required: false, description: "Short description below heading" },
      { name: "apiBase", type: "url", required: true, description: "Base URL of the download API (e.g. https://your-tunnel.trycloudflare.com)" },
      { name: "apiToken", type: "string", required: true, description: "API authentication token sent as 'token' header" },
      { name: "maxVideoQuality", type: "string", required: false, description: "Optional cap on video quality: '2160' | '1080' | '720' | '480'. Buttons above this value are hidden (e.g. '1080' hides the 4K button). Default: '2160' (all qualities shown)." },
    ],
  },
  {
    type: "tool",
    name: "Tool",
    description: "Universal interactive tool section. Supports text inputs, file uploads (single/multiple with drag & drop), toggle/select options, and displays results as file downloads, image previews, or text. Connect any backend API. Use this for PDF tools, image processing, file conversion, or any custom tool.",
    fields: [
      { name: "heading", type: "string", required: false, description: "Section heading (e.g. 'PDF Merger', 'Image Compressor')" },
      { name: "description", type: "string", required: false, description: "Short description of what the tool does" },
      { name: "apiBase", type: "url", required: true, description: "Base URL of the backend API (e.g. https://your-api.trycloudflare.com)" },
      { name: "apiEndpoint", type: "string", required: true, description: "API endpoint path (e.g. /merge-pdf, /remove-bg, /compress)" },
      { name: "apiToken", type: "string", required: false, description: "Optional API token sent as 'token' header" },
      {
        name: "fields", type: "array", required: true, description: "Input fields for the tool",
        items: [
          { name: "type", type: "string", required: true, description: "'text' | 'url' | 'password' | 'file' | 'select' | 'toggle'" },
          { name: "name", type: "string", required: true, description: "Field identifier sent in the request" },
          { name: "label", type: "string", required: true, description: "Label shown to the user" },
          { name: "placeholder", type: "string", required: false, description: "Placeholder text (text/url/password)" },
          { name: "required", type: "boolean", required: false, description: "Whether the field must be filled" },
          { name: "accept", type: "string", required: false, description: "Accepted file types for file fields (e.g. '.pdf', 'image/*')" },
          { name: "multiple", type: "boolean", required: false, description: "Allow multiple files (file fields only)" },
          { name: "maxSizeMB", type: "number", required: false, description: "Max file size in MB (file fields only)" },
          { name: "options", type: "array", required: false, description: "Options for select/toggle fields", items: [
            { name: "value", type: "string", required: true, description: "Option value sent in the request" },
            { name: "label", type: "string", required: true, description: "Option label shown to the user" },
          ] },
        ],
      },
      { name: "submitLabel", type: "string", required: false, description: "Submit button text (default: 'Process')" },
      { name: "resultType", type: "string", required: false, description: "'download' | 'preview' | 'text' | 'auto' (default: 'auto')" },
      { name: "fileSizeLimit", type: "string", required: false, description: "File size limit hint shown to users (e.g. '50MB')" },
      { name: "expiresIn", type: "string", required: false, description: "How long results are available (e.g. '1 hour')" },
    ],
  },
  {
    type: "pdf-viewer",
    name: "PDF Viewer",
    description: "Interactive PDF viewer with password unlock and save-as-unlocked functionality. Users upload a PDF (drag & drop), preview pages with zoom and navigation, enter a password if the file is encrypted, and save an unlocked copy. Fully client-side — no backend required.",
    fields: [
      { name: "heading", type: "string", required: false, description: "Section heading (e.g. 'PDF Viewer', 'Unlock PDF')" },
      { name: "description", type: "string", required: false, description: "Short description of the tool" },
    ],
  },
  {
    type: "iframe-tool",
    name: "Iframe Tool",
    description: "Embed any tool you (or an agent) deployed to a free static host as an interactive section on the page. Use this for vibe-coded tools — wheel spinners, calculators, mini-games, drawing pads, visualizations — that the agent built and pushed to Vercel / Cloudflare Pages / Netlify / GitHub Pages. AppAI wraps it in a multi-language SEO landing page. The iframe is sandboxed (no top-nav, isolated origin) and auto-resizes when the tool sends a postMessage(`{type:'resize', height}`). The locale, theme color, and dark-mode flag are appended to the iframe URL as query params (`?locale=...&color=...&theme=dark`) so the tool can match the host page. Each section also gets a standalone fullscreen URL at /p/{slug}/tools/{order}.",
    fields: [
      { name: "heading", type: "string", required: true, description: "Section heading. Required because iframes are invisible to search engines — this text is what gets indexed. Minimum 5 characters." },
      { name: "description", type: "string", required: true, description: "Short paragraph describing what the tool does. Required for SEO. Minimum 30 characters." },
      { name: "features", type: "array", required: false, description: "Optional list of bullet-point feature strings rendered above the iframe." },
      { name: "src", type: "url", required: true, description: "Tool URL. Must be https:// and the host must match the iframe-tool allowlist: *.vercel.app, *.pages.dev, *.netlify.app, *.github.io. Custom domains are not currently allowed." },
      { name: "initialHeight", type: "number", required: false, description: "Initial iframe height in pixels (default 600). The iframe can request a new height by sending postMessage({type:'resize', height}). Clamped to 200..4000." },
      { name: "allowFullscreen", type: "boolean", required: false, description: "Whether the iframe can request fullscreen mode (default true). Useful for games and visualizations." },
    ],
  },
  {
    type: "embed",
    name: "Embed",
    description: "Embed content from TikTok, Loom, YouTube, Vimeo, Spotify, CodePen, or Figma. Auto-detects the provider from the URL and renders a sandboxed iframe with the right aspect ratio. X (Twitter) and Instagram render as linked preview cards (their iframe policy blocks direct embedding). Use this when showing a short-form video, design prototype, music track, code demo, or tutorial recording.",
    fields: [
      { name: "url", type: "url", required: true, description: "URL of the content to embed. Examples: https://www.tiktok.com/@user/video/123, https://www.loom.com/share/abc, https://youtu.be/xyz, https://open.spotify.com/track/abc, https://codepen.io/user/pen/abc, https://www.figma.com/file/..." },
      { name: "title", type: "string", required: false, description: "Optional heading rendered above the embed" },
      { name: "caption", type: "string", required: false, description: "Optional caption rendered below the embed" },
      { name: "aspectRatio", type: "string", required: false, description: "'16:9' (default for YouTube/Vimeo/Loom), '9:16' (default for TikTok), '1:1', or '4:5' (Figma)" },
    ],
  },
  {
    type: "form",
    name: "Form",
    description: "Contact or account-management form. Renders a real HTML form with typed fields. On submit, our backend relays to either an email address (submitTo: 'mailto:...') or a webhook (submitTo: 'https://...') — the user's device does not need a configured mail client. Required for App Store compliance pages like contact, delete-account, or data-export.",
    fields: [
      { name: "heading", type: "string", required: false, description: "Section heading" },
      { name: "description", type: "markdown", required: false, description: "Short description above the form (Markdown supported)" },
      {
        name: "fields", type: "array", required: true, description: "Form field definitions",
        items: [
          { name: "type", type: "string", required: true, description: "'text' | 'email' | 'tel' | 'textarea' | 'select'" },
          { name: "name", type: "string", required: true, description: "Field identifier, sent in the submission payload" },
          { name: "label", type: "string", required: true, description: "Label shown above the field" },
          { name: "required", type: "boolean", required: false, description: "Whether the field must be filled before submit" },
          { name: "placeholder", type: "string", required: false, description: "Placeholder text shown inside the field" },
          { name: "options", type: "array", required: false, description: "For type 'select' only: dropdown choices" },
        ],
      },
      { name: "submitTo", type: "string", required: true, description: "Destination: 'mailto:you@example.com' (email relay) or 'https://...' (webhook). Non-https webhooks are rejected." },
      { name: "submitLabel", type: "string", required: false, description: "Submit button text (default: 'Submit')" },
      { name: "successMessage", type: "markdown", required: false, description: "Message shown after successful submission" },
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
