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
    icon: { src: string } | null;
    screenshot: { src: string; alt: string; kind: "phone" | "web"; width: number; height: number } | null;
    links: Array<{ label: string; href: string }>;
  }>;
  experience: Array<{
    title: string;
    description: string;
  }>;
  contactNote: string;
}

export interface EditorialProfile {
  handle: string;
  name: string;
  tagline: string;
  initials: string;
  avatar: { src: string; alt: string } | null;
  links: { linkedin: string | null; youtube: string | null };
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
    // TODO(owner): LinkedIn URL, YouTube channel, and local avatar file under public/people/grayson/ pending from owner (no remote next/image hosts configured).
    avatar: null,
    links: { linkedin: null, youtube: null },
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
            category: "iOS app · AI cooking",
            description: "Turns YouTube cooking videos into step-by-step recipes and a hands-free, voice-guided cooking assistant.",
            icon: {
              src: "/people/grayson/chefchef-icon.png",
            },
            screenshot: {
              src: "/people/grayson/chefchef-en-1.webp",
              alt: "ChefChef — app screenshot",
              kind: "phone",
              width: 600,
              height: 1304,
            },
            links: [
              {
                label: "App Store",
                href: "https://apps.apple.com/us/app/chefchef-ai-youtube-to-recipe/id6754978898",
              },
              {
                label: "Website",
                href: "https://chefchef.app/",
              },
            ],
          },
          // TODO(owner): confirm naming — zh pages use 健保快追蹤, en uses MedLogAI.
          {
            name: "MedLogAI",
            category: "iOS app · Health records",
            description: "Imports your lab results from Taiwan's NHI health records app, tracks the trends over time and explains each test item with AI. Not an official NHI app; not medical advice.",
            icon: {
              src: "/people/grayson/medlog-icon.png",
            },
            screenshot: {
              src: "/people/grayson/medlog-1.webp",
              alt: "MedLogAI — app screenshot",
              kind: "phone",
              width: 600,
              height: 1304,
            },
            links: [
              {
                label: "App Store",
                href: "https://apps.apple.com/us/app/%E5%81%A5%E4%BF%9D%E5%BF%AB%E8%BF%BD%E8%B9%A4-%E6%AA%A2%E9%A9%97%E5%A0%B1%E5%91%8A%E8%88%87%E6%8A%BD%E8%A1%80%E6%95%B8%E5%80%BC%E8%B6%A8%E5%8B%A2%E5%88%86%E6%9E%90/id6760481129",
              },
            ],
          },
          {
            name: "AppAI",
            category: "Platform",
            description: "A hosting platform where AI agents publish landing pages, tools and apps for their creators — no domain needed.",
            icon: {
              src: "/people/grayson/appai-icon.png",
            },
            screenshot: {
              src: "/people/grayson/appai-en-1.jpg",
              alt: "AppAI — app screenshot",
              kind: "web",
              width: 900,
              height: 562,
            },
            links: [
              {
                label: "appai.info",
                href: "/",
              },
            ],
          },
          {
            name: "ShiftSnap",
            category: "Mobile app · In development",
            description: "Snap a photo of a paper shift roster; AI reads it and syncs the shifts to your calendar.",
            icon: {
              src: "/people/grayson/shiftsnap-icon.png",
            },
            screenshot: {
              src: "/people/grayson/shiftsnap-1.jpg",
              alt: "ShiftSnap — app screenshot",
              kind: "phone",
              width: 600,
              height: 1304,
            },
            links: [],
          },
          {
            name: "Simpleshop",
            category: "Web app · In development",
            description: "A simple shop-management app for small businesses: customers, job sites and items in one place, running on AppAI.",
            icon: null,
            screenshot: {
              src: "/people/grayson/simpleshop-1.jpg",
              alt: "Simpleshop customers and job sites screen (demo data)",
              kind: "web",
              width: 900,
              height: 562,
            },
            links: [],
          },
          {
            name: "YouTube video tools",
            category: "Web tools",
            description: "A set of tools for video work: downloading media, generating subtitles, and cutting livestream highlights automatically.",
            icon: {
              src: "/people/grayson/youtube-tools-icon.png",
            },
            screenshot: {
              src: "/people/grayson/youtube-tools-1.jpg",
              alt: "YouTube video tools — app screenshot",
              kind: "web",
              width: 900,
              height: 562,
            },
            links: [
              {
                label: "Media Downloader",
                href: "/p/media-downloader",
              },
              {
                label: "Subtitle Studio",
                href: "/p/subtitle",
              },
              {
                label: "Stream Highlights",
                href: "/p/stream-highlights",
              },
            ],
          },
        ],
        experience: [
          {
            title: "APAC commercial development",
            description: "Developing customer relationships and commercial opportunities across APAC.",
          },
          {
            title: "Cross-border delivery",
            description: "Coordinating customer needs, delivery, and acceptance across markets.",
          },
          {
            title: "AI product building",
            description: "Taking part directly in shaping product problems and implementing AI-enabled software.",
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
            category: "iOS App · AI 料理",
            description: "把 YouTube 料理影片變成一步步的食譜，下廚時用語音帶著你做，不用動手滑手機。",
            icon: {
              src: "/people/grayson/chefchef-icon.png",
            },
            screenshot: {
              src: "/people/grayson/chefchef-zh-1.webp",
              alt: "ChefChef App 畫面",
              kind: "phone",
              width: 600,
              height: 1304,
            },
            links: [
              {
                label: "App Store",
                href: "https://apps.apple.com/tw/app/chefchef-youtube%E9%A3%9F%E8%AD%9C%E6%96%99%E7%90%86ai/id6754978898",
              },
              {
                label: "網站",
                href: "https://chefchef.app/",
              },
            ],
          },
          // TODO(owner): confirm naming — zh pages use 健保快追蹤, en uses MedLogAI.
          {
            name: "健保快追蹤",
            category: "iOS App · 健康紀錄",
            description: "匯入健保「健康存摺」的檢驗資料，整理歷次結果、看數值趨勢，並用 AI 說明每個檢驗項目。非健保署官方 App，不提供醫療建議。",
            icon: {
              src: "/people/grayson/medlog-icon.png",
            },
            screenshot: {
              src: "/people/grayson/medlog-1.webp",
              alt: "健保快追蹤 App 畫面",
              kind: "phone",
              width: 600,
              height: 1304,
            },
            links: [
              {
                label: "App Store",
                href: "https://apps.apple.com/tw/app/%E5%81%A5%E4%BF%9D%E5%BF%AB%E8%BF%BD%E8%B9%A4-%E6%AA%A2%E9%A9%97%E5%A0%B1%E5%91%8A%E8%88%87%E6%8A%BD%E8%A1%80%E6%95%B8%E5%80%BC%E8%B6%A8%E5%8B%A2%E5%88%86%E6%9E%90/id6760481129",
              },
            ],
          },
          {
            name: "AppAI",
            category: "平台",
            description: "讓 AI agent 為創作者發布網站、工具與應用程式的託管平台，不需要自己的網域。",
            icon: {
              src: "/people/grayson/appai-icon.png",
            },
            screenshot: {
              src: "/people/grayson/appai-zh-1.jpg",
              alt: "AppAI 網站畫面",
              kind: "web",
              width: 900,
              height: 562,
            },
            links: [
              {
                label: "appai.info",
                href: "/",
              },
            ],
          },
          {
            name: "ShiftSnap",
            category: "手機 App · 開發中",
            description: "拍下紙本班表，AI 自動辨識並把班表同步到行事曆。",
            icon: {
              src: "/people/grayson/shiftsnap-icon.png",
            },
            screenshot: {
              src: "/people/grayson/shiftsnap-1.jpg",
              alt: "ShiftSnap App 畫面",
              kind: "phone",
              width: 600,
              height: 1304,
            },
            links: [],
          },
          {
            name: "Simpleshop",
            category: "網頁 App · 開發中",
            description: "給小店家的簡單管理工具：客戶、施工地點與品項集中管理，跑在 AppAI 上。",
            icon: null,
            screenshot: {
              src: "/people/grayson/simpleshop-1.jpg",
              alt: "Simpleshop 客戶與工地畫面（示範資料）",
              kind: "web",
              width: 900,
              height: 562,
            },
            links: [],
          },
          {
            name: "YouTube 影片工具",
            category: "網頁工具",
            description: "做影片用的一組工具：下載影音、產生字幕、直播結束後自動剪出精華。",
            icon: {
              src: "/people/grayson/youtube-tools-icon.png",
            },
            screenshot: {
              src: "/people/grayson/youtube-tools-1.jpg",
              alt: "YouTube 影片工具 網站畫面",
              kind: "web",
              width: 900,
              height: 562,
            },
            links: [
              {
                label: "Media Downloader",
                href: "/p/media-downloader",
              },
              {
                label: "Subtitle Studio",
                href: "/p/subtitle",
              },
              {
                label: "Stream Highlights",
                href: "/p/stream-highlights",
              },
            ],
          },
        ],
        experience: [
          {
            title: "亞太商務拓展",
            description: "透過客戶協作與商務規劃，推進亞太區的商務機會。",
          },
          {
            title: "跨境交付",
            description: "協調不同市場的客戶需求、交付流程與驗收安排。",
          },
          {
            title: "AI 產品實作",
            description: "親自參與 AI 軟體產品的問題梳理與功能實作。",
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
            category: "iOS App · AI 烹饪",
            description: "把 YouTube 烹饪视频变成分步骤的食谱，做菜时用语音带着你做，不用动手滑手机。",
            icon: {
              src: "/people/grayson/chefchef-icon.png",
            },
            screenshot: {
              src: "/people/grayson/chefchef-zh-1.webp",
              alt: "ChefChef App 画面",
              kind: "phone",
              width: 600,
              height: 1304,
            },
            links: [
              {
                label: "App Store",
                href: "https://apps.apple.com/tw/app/chefchef-youtube%E9%A3%9F%E8%AD%9C%E6%96%99%E7%90%86ai/id6754978898",
              },
              {
                label: "网站",
                href: "https://chefchef.app/",
              },
            ],
          },
          // TODO(owner): confirm naming — zh pages use 健保快追蹤, en uses MedLogAI.
          {
            name: "健保快追蹤",
            category: "iOS App · 健康记录",
            description: "导入台湾健保「健康存折」的检验数据，整理历次结果、查看数值趋势，并用 AI 解释每个检验项目。非健保署官方 App，不提供医疗建议。",
            icon: {
              src: "/people/grayson/medlog-icon.png",
            },
            screenshot: {
              src: "/people/grayson/medlog-1.webp",
              alt: "健保快追蹤 App 画面",
              kind: "phone",
              width: 600,
              height: 1304,
            },
            links: [
              {
                label: "App Store",
                href: "https://apps.apple.com/tw/app/%E5%81%A5%E4%BF%9D%E5%BF%AB%E8%BF%BD%E8%B9%A4-%E6%AA%A2%E9%A9%97%E5%A0%B1%E5%91%8A%E8%88%87%E6%8A%BD%E8%A1%80%E6%95%B8%E5%80%BC%E8%B6%A8%E5%8B%A2%E5%88%86%E6%9E%90/id6760481129",
              },
            ],
          },
          {
            name: "AppAI",
            category: "平台",
            description: "让 AI agent 为创作者发布网站、工具与应用的托管平台，不需要自己的域名。",
            icon: {
              src: "/people/grayson/appai-icon.png",
            },
            screenshot: {
              src: "/people/grayson/appai-zh-1.jpg",
              alt: "AppAI 网站画面",
              kind: "web",
              width: 900,
              height: 562,
            },
            links: [
              {
                label: "appai.info",
                href: "/",
              },
            ],
          },
          {
            name: "ShiftSnap",
            category: "手机 App · 开发中",
            description: "拍下纸质排班表，AI 自动识别并把班次同步到日历。",
            icon: {
              src: "/people/grayson/shiftsnap-icon.png",
            },
            screenshot: {
              src: "/people/grayson/shiftsnap-1.jpg",
              alt: "ShiftSnap App 画面",
              kind: "phone",
              width: 600,
              height: 1304,
            },
            links: [],
          },
          {
            name: "Simpleshop",
            category: "网页 App · 开发中",
            description: "给小店家的简单管理工具：客户、施工地点与品项集中管理，运行在 AppAI 上。",
            icon: null,
            screenshot: {
              src: "/people/grayson/simpleshop-1.jpg",
              alt: "Simpleshop 客户与工地画面（示范数据）",
              kind: "web",
              width: 900,
              height: 562,
            },
            links: [],
          },
          {
            name: "YouTube 视频工具",
            category: "网页工具",
            description: "做视频用的一组工具：下载音视频、生成字幕、直播结束后自动剪出精华。",
            icon: {
              src: "/people/grayson/youtube-tools-icon.png",
            },
            screenshot: {
              src: "/people/grayson/youtube-tools-1.jpg",
              alt: "YouTube 视频工具 网站画面",
              kind: "web",
              width: 900,
              height: 562,
            },
            links: [
              {
                label: "Media Downloader",
                href: "/p/media-downloader",
              },
              {
                label: "Subtitle Studio",
                href: "/p/subtitle",
              },
              {
                label: "Stream Highlights",
                href: "/p/stream-highlights",
              },
            ],
          },
        ],
        experience: [
          {
            title: "亚太商务拓展",
            description: "通过客户协作与商务规划，推进亚太区的商务机会。",
          },
          {
            title: "跨境交付",
            description: "协调不同市场的客户需求、交付流程与验收安排。",
          },
          {
            title: "AI 产品实践",
            description: "亲自参与 AI 软件产品的问题梳理与功能实现。",
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
