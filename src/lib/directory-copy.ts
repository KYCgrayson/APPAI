import type { DirectoryKind } from "./directory-kind";

type Copy = {
  title: string;
  description: string;
  entranceTitle: string;
  entranceDescription: string;
  label: string;
  emptyTitle: string;
  emptyDescription: string;
  personal: string;
  all: string;
  categoriesLabel: string;
  categories: { websites: string; tools: string; apps: string };
  entrances: Record<DirectoryKind, { title: string; description: string; action: string }>;
};

const COPY: Record<string, Copy> = {
  en: {
    title: "Explore AppAI",
    description: "Browse published websites, practical tools, and applications made with AppAI.",
    entranceTitle: "Find what you need",
    entranceDescription: "Explore public work across three clear destinations.",
    label: "Directory",
    emptyTitle: "Nothing here yet",
    emptyDescription: "Published entries will appear here.",
    personal: "Personal",
    all: "All",
    categoriesLabel: "Purpose categories",
    categories: { websites: "Websites", tools: "Tools", apps: "Apps" },
    entrances: {
      websites: { title: "Websites", description: "Personal sites, portfolios, and public project pages.", action: "Explore websites" },
      tools: { title: "Tools", description: "Focused tools for getting useful work done, such as media download and subtitle workflows.", action: "Explore tools" },
      apps: { title: "Apps", description: "Full applications, including reviewed AppAI apps.", action: "Explore apps" },
    },
  },
  "zh-TW": {
    title: "探索 AppAI",
    description: "瀏覽以 AppAI 建立並公開的網站、實用工具與應用程式。",
    entranceTitle: "找到你需要的內容",
    entranceDescription: "透過三個清楚的入口，探索已公開的作品。",
    label: "目錄",
    emptyTitle: "目前沒有項目",
    emptyDescription: "已發布的項目會顯示在這裡。",
    personal: "個人網站",
    all: "全部",
    categoriesLabel: "用途分類",
    categories: { websites: "網站", tools: "工具", apps: "應用程式" },
    entrances: {
      websites: { title: "網站", description: "個人網站、作品集與公開專案頁面。", action: "探索網站" },
      tools: { title: "工具", description: "協助完成實用工作的專用工具，例如媒體下載與字幕工作流程。", action: "探索工具" },
      apps: { title: "應用程式", description: "完整應用程式，包含經 AppAI 審核的應用。", action: "探索應用程式" },
    },
  },
  "zh-CN": {
    title: "探索 AppAI",
    description: "浏览使用 AppAI 创建并公开的网站、实用工具和应用程序。",
    entranceTitle: "找到你需要的内容",
    entranceDescription: "通过三个清晰入口，探索已公开的作品。",
    label: "目录",
    emptyTitle: "目前没有项目",
    emptyDescription: "已发布的项目会显示在这里。",
    personal: "个人网站",
    all: "全部",
    categoriesLabel: "用途分类",
    categories: { websites: "网站", tools: "工具", apps: "应用程序" },
    entrances: {
      websites: { title: "网站", description: "个人网站、作品集和公开项目页面。", action: "探索网站" },
      tools: { title: "工具", description: "帮助完成实用工作的专用工具，例如媒体下载和字幕工作流程。", action: "探索工具" },
      apps: { title: "应用程序", description: "完整应用程序，包含经 AppAI 审核的应用。", action: "探索应用" },
    },
  },
};

export function getDirectoryCopy(locale: string): Copy {
  return COPY[locale] ?? COPY.en;
}
