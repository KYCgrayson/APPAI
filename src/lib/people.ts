import type { Locale } from "@/i18n/routing";

export type ProfileLocale = "en" | "zh-TW" | "zh-CN";

export interface ProfileCopy {
  name: string;
  tagline: string;
  eyebrow: string;
  introduction: string[];
  focus: string[];
  projects: Array<{
    name: string;
    category: string;
    description: string;
    href: string | null;
  }>;
  experience: Array<{
    organization: string;
    area: string;
    description: string;
  }>;
  contactNote: string;
}

export interface EditorialProfile {
  handle: string;
  name: string;
  tagline: string;
  initials: string;
  published: boolean;
  copy: Record<ProfileLocale, ProfileCopy>;
}

/**
 * First-party editorial profiles are authored and versioned with the platform.
 * They are not user-created database records or self-service profile pages.
 */
const profiles: readonly EditorialProfile[] = [
  {
    handle: "grayson",
    name: "Grayson",
    tagline: "Commercial perspective. Product builder's instinct.",
    initials: "G",
    published: true,
    copy: {
      en: {
        name: "Grayson",
        tagline: "Commercial perspective. Product builder's instinct.",
        eyebrow: "Personal website",
        introduction: [
          "I work across APAC commercial development and hands-on AI product building. My background is in capital equipment and inspection systems, where good work depends on understanding the technology, the customer, and the realities of delivery.",
          "Today I bring that same practical perspective to building useful software: start with a real problem, make the experience clear, and keep learning from how people use it.",
        ],
        focus: [
          "Strategic accounts and commercial development across APAC",
          "Capital equipment commercialization and cross-border delivery",
          "AI product thinking, prototyping, and hands-on building",
        ],
        projects: [
          {
            name: "ChefChef",
            category: "AI recipe product",
            description:
              "Turns YouTube cooking videos into structured recipes and a hands-free cooking assistant.",
            href: "https://chefchef.app/",
          },
          {
            name: "MedLogAI",
            category: "Health record product",
            description:
              "A health record product focused on helping people keep and understand their personal medical information.",
            href: null,
          },
          {
            name: "AppAI",
            category: "Publishing platform",
            description:
              "A platform for publishing AI-built websites and applications with managed capabilities.",
            href: "/websites",
          },
          {
            name: "Personal experiments",
            category: "Ongoing practice",
            description:
              "Small experiments in software, automation, and practical ways to bring AI into everyday work.",
            href: null,
          },
        ],
        experience: [
          {
            organization: "Meyer Burger",
            area: "Capital-equipment commercialization",
            description:
              "Commercial work around capital equipment, including customer coordination and cross-border delivery and acceptance.",
          },
          {
            organization: "Chroma ATE",
            area: "Automated optical inspection",
            description:
              "Commercial experience connected to AOI systems and inspection technology.",
          },
          {
            organization: "Independent product building",
            area: "AI-enabled products",
            description:
              "Building and refining products directly, from framing a user problem through implementation and release work.",
          },
        ],
        contactNote: "Contact details will be added after review.",
      },
      "zh-TW": {
        name: "Grayson",
        tagline: "商務視角，產品實作。",
        eyebrow: "個人網站",
        introduction: [
          "我長期投入亞太區商務拓展，也親自參與 AI 產品開發。過去的經驗涵蓋資本設備與檢測系統；要把事情做好，必須同時理解技術、客戶需求，以及交付現場的實際條件。",
          "現在我把相同的務實方法帶進軟體產品：從真實問題出發，讓使用方式清楚，並持續根據實際使用情況調整。",
        ],
        focus: [
          "亞太區策略客戶與商務拓展",
          "資本設備商務化與跨境交付",
          "AI 產品規劃、原型製作與實際開發",
        ],
        projects: [
          {
            name: "ChefChef",
            category: "AI 食譜產品",
            description: "將 YouTube 烹飪影片整理成結構化食譜，並提供烹飪過程中的語音助理。",
            href: "https://chefchef.app/",
          },
          {
            name: "MedLogAI",
            category: "健康紀錄產品",
            description: "聚焦於協助使用者保存並理解個人醫療資訊的健康紀錄產品。",
            href: null,
          },
          {
            name: "AppAI",
            category: "網站發布平台",
            description: "讓 AI 建立的網站與應用程式能透過平台發布並使用受管理的能力。",
            href: "/websites",
          },
          {
            name: "個人實驗",
            category: "持續探索",
            description: "持續嘗試軟體、自動化，以及 AI 如何實際融入日常工作。",
            href: null,
          },
        ],
        experience: [
          {
            organization: "Meyer Burger",
            area: "資本設備商務化",
            description: "參與資本設備相關商務工作，包括客戶協調、跨境交付與驗收。",
          },
          {
            organization: "Chroma ATE",
            area: "自動光學檢測",
            description: "具備與 AOI 系統及檢測技術相關的商務經驗。",
          },
          {
            organization: "獨立產品開發",
            area: "AI 應用產品",
            description: "親自投入產品開發與調整，從釐清使用者問題到實作及發布工作。",
          },
        ],
        contactNote: "聯絡資訊將於確認後補上。",
      },
      "zh-CN": {
        name: "Grayson",
        tagline: "商业视角，产品实践。",
        eyebrow: "个人网站",
        introduction: [
          "我长期参与亚太区商务拓展，也亲自参与 AI 产品开发。过去的经验涵盖资本设备与检测系统；要把事情做好，需要同时理解技术、客户需求，以及交付现场的实际条件。",
          "现在我把同样务实的方法带入软件产品：从真实问题出发，让使用方式清晰，并持续根据实际使用情况调整。",
        ],
        focus: [
          "亚太区战略客户与商务拓展",
          "资本设备商业化与跨境交付",
          "AI 产品规划、原型制作与实际开发",
        ],
        projects: [
          {
            name: "ChefChef",
            category: "AI 食谱产品",
            description: "将 YouTube 烹饪视频整理成结构化食谱，并提供烹饪过程中的语音助手。",
            href: "https://chefchef.app/",
          },
          {
            name: "MedLogAI",
            category: "健康记录产品",
            description: "聚焦于帮助用户保存并理解个人医疗信息的健康记录产品。",
            href: null,
          },
          {
            name: "AppAI",
            category: "网站发布平台",
            description: "让 AI 构建的网站与应用程序通过平台发布并使用受管理的能力。",
            href: "/websites",
          },
          {
            name: "个人实验",
            category: "持续探索",
            description: "持续尝试软件、自动化，以及 AI 如何实际融入日常工作。",
            href: null,
          },
        ],
        experience: [
          {
            organization: "Meyer Burger",
            area: "资本设备商业化",
            description: "参与资本设备相关商务工作，包括客户协调、跨境交付与验收。",
          },
          {
            organization: "Chroma ATE",
            area: "自动光学检测",
            description: "具备与 AOI 系统及检测技术相关的商务经验。",
          },
          {
            organization: "独立产品开发",
            area: "AI 应用产品",
            description: "亲自投入产品开发与调整，从梳理用户问题到实现及发布工作。",
          },
        ],
        contactNote: "联系信息将在确认后补充。",
      },
    },
  },
];

export function getPublishedProfiles(): EditorialProfile[] {
  return profiles.filter((profile) => profile.published);
}

export function getProfile(handle: string): EditorialProfile | null {
  const profile = profiles.find((candidate) => candidate.handle === handle);
  return profile?.published ? profile : null;
}

export function getProfileCopy(
  profile: EditorialProfile,
  locale: Locale | string,
): ProfileCopy {
  if (locale === "zh-TW" || locale === "zh-CN") return profile.copy[locale];
  return profile.copy.en;
}
