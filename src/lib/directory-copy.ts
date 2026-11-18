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
  by: string;
  personalPages: string;
  moreCategories: string;
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
    by: "By", personalPages: "Personal pages", moreCategories: "More categories",
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
    by: "發布者", personalPages: "個人頁", moreCategories: "更多分類",
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
    by: "发布者", personalPages: "个人页", moreCategories: "更多分类",
    all: "全部",
    categoriesLabel: "用途分类",
    categories: { websites: "网站", tools: "工具", apps: "应用程序" },
    entrances: {
      websites: { title: "网站", description: "个人网站、作品集和公开项目页面。", action: "探索网站" },
      tools: { title: "工具", description: "帮助完成实用工作的专用工具，例如媒体下载和字幕工作流程。", action: "探索工具" },
      apps: { title: "应用程序", description: "完整应用程序，包含经 AppAI 审核的应用。", action: "探索应用" },
    },
  },
"ja": {
  "title": "AppAI を探す",
  "description": "AppAI で公開されたウェブサイト、便利なツール、アプリを探せます。",
  "entranceTitle": "必要なものを見つける",
  "entranceDescription": "3つのカテゴリーから公開作品を探せます。",
  "label": "一覧",
  "emptyTitle": "まだありません",
  "emptyDescription": "公開された作品がここに表示されます。",
  "personal": "個人サイト",
  "by": "公開者",
  "personalPages": "個人ページ",
  "moreCategories": "ほかのカテゴリー",
  "all": "すべて",
  "categoriesLabel": "用途別カテゴリー",
  "categories": {
    "websites": "ウェブサイト",
    "tools": "ツール",
    "apps": "アプリ"
  },
  "entrances": {
    "websites": {
      "title": "ウェブサイト",
      "description": "個人サイト、ポートフォリオ、プロジェクトの紹介。",
      "action": "サイトを探す"
    },
    "tools": {
      "title": "ツール",
      "description": "メディアのダウンロードや字幕作成に役立つツール。",
      "action": "ツールを探す"
    },
    "apps": {
      "title": "アプリ",
      "description": "AppAI の審査済みアプリを含む、さまざまなアプリ。",
      "action": "アプリを探す"
    }
  }
},

"ko": {
  "title": "AppAI 둘러보기",
  "description": "AppAI로 만든 웹사이트, 유용한 도구와 앱을 만나 보세요.",
  "entranceTitle": "필요한 것을 찾아보세요",
  "entranceDescription": "세 가지 카테고리에서 공개된 작업을 둘러보세요.",
  "label": "목록",
  "emptyTitle": "아직 항목이 없어요",
  "emptyDescription": "공개된 항목이 여기에 표시됩니다.",
  "personal": "개인 사이트",
  "by": "게시자",
  "personalPages": "개인 페이지",
  "moreCategories": "다른 카테고리",
  "all": "전체",
  "categoriesLabel": "용도별 카테고리",
  "categories": {
    "websites": "웹사이트",
    "tools": "도구",
    "apps": "앱"
  },
  "entrances": {
    "websites": {
      "title": "웹사이트",
      "description": "개인 사이트, 포트폴리오와 프로젝트 소개 페이지.",
      "action": "웹사이트 둘러보기"
    },
    "tools": {
      "title": "도구",
      "description": "미디어 다운로드와 자막 작업 등에 유용한 도구.",
      "action": "도구 둘러보기"
    },
    "apps": {
      "title": "앱",
      "description": "AppAI 심사를 거친 앱을 포함한 다양한 앱.",
      "action": "앱 둘러보기"
    }
  }
},

"de": {
  "title": "AppAI entdecken",
  "description": "Websites, nützliche Tools und Apps entdecken, die mit AppAI erstellt wurden.",
  "entranceTitle": "Finde, was du brauchst",
  "entranceDescription": "Entdecke veröffentlichte Projekte in drei Kategorien.",
  "label": "Verzeichnis",
  "emptyTitle": "Noch keine Einträge",
  "emptyDescription": "Veröffentlichte Einträge erscheinen hier.",
  "personal": "Persönliche Website",
  "by": "Von",
  "personalPages": "Persönliche Seiten",
  "moreCategories": "Weitere Kategorien",
  "all": "Alle",
  "categoriesLabel": "Kategorien nach Zweck",
  "categories": {
    "websites": "Websites",
    "tools": "Tools",
    "apps": "Apps"
  },
  "entrances": {
    "websites": {
      "title": "Websites",
      "description": "Persönliche Websites, Portfolios und Projektseiten.",
      "action": "Websites entdecken"
    },
    "tools": {
      "title": "Tools",
      "description": "Helfer für Mediendownloads, Untertitel und andere Aufgaben.",
      "action": "Tools entdecken"
    },
    "apps": {
      "title": "Apps",
      "description": "Vollständige Anwendungen, darunter von AppAI geprüfte Apps.",
      "action": "Apps entdecken"
    }
  }
},

"fr": {
  "title": "Découvrir AppAI",
  "description": "Parcourez les sites, outils pratiques et applications créés avec AppAI.",
  "entranceTitle": "Trouvez ce qu’il vous faut",
  "entranceDescription": "Explorez les créations publiées dans trois catégories.",
  "label": "Annuaire",
  "emptyTitle": "Rien pour le moment",
  "emptyDescription": "Les publications apparaîtront ici.",
  "personal": "Site personnel",
  "by": "Par",
  "personalPages": "Pages personnelles",
  "moreCategories": "Autres catégories",
  "all": "Tout",
  "categoriesLabel": "Catégories par usage",
  "categories": {
    "websites": "Sites web",
    "tools": "Outils",
    "apps": "Applications"
  },
  "entrances": {
    "websites": {
      "title": "Sites web",
      "description": "Sites personnels, portfolios et pages de projets.",
      "action": "Explorer les sites"
    },
    "tools": {
      "title": "Outils",
      "description": "Des outils pour télécharger des médias, créer des sous-titres et plus encore.",
      "action": "Explorer les outils"
    },
    "apps": {
      "title": "Applications",
      "description": "Des applications complètes, dont celles examinées par AppAI.",
      "action": "Explorer les applications"
    }
  }
},

"es": {
  "title": "Explora AppAI",
  "description": "Descubre sitios web, herramientas útiles y aplicaciones creadas con AppAI.",
  "entranceTitle": "Encuentra lo que necesitas",
  "entranceDescription": "Explora los proyectos publicados en tres categorías.",
  "label": "Directorio",
  "emptyTitle": "Aún no hay nada",
  "emptyDescription": "Los proyectos publicados aparecerán aquí.",
  "personal": "Sitio personal",
  "by": "Por",
  "personalPages": "Páginas personales",
  "moreCategories": "Más categorías",
  "all": "Todo",
  "categoriesLabel": "Categorías por uso",
  "categories": {
    "websites": "Sitios web",
    "tools": "Herramientas",
    "apps": "Aplicaciones"
  },
  "entrances": {
    "websites": {
      "title": "Sitios web",
      "description": "Sitios personales, portafolios y páginas de proyectos.",
      "action": "Explorar sitios"
    },
    "tools": {
      "title": "Herramientas",
      "description": "Herramientas para descargar contenido multimedia, crear subtítulos y más.",
      "action": "Explorar herramientas"
    },
    "apps": {
      "title": "Aplicaciones",
      "description": "Aplicaciones completas, incluidas las revisadas por AppAI.",
      "action": "Explorar aplicaciones"
    }
  }
},

"hi": {
  "title": "AppAI पर खोजें",
  "description": "AppAI से बनी वेबसाइटें, उपयोगी टूल और ऐप देखें।",
  "entranceTitle": "अपनी ज़रूरत की चीज़ खोजें",
  "entranceDescription": "तीन श्रेणियों में प्रकाशित काम देखें।",
  "label": "सूची",
  "emptyTitle": "अभी कोई सामग्री नहीं है",
  "emptyDescription": "प्रकाशित सामग्री यहाँ दिखाई देगी।",
  "personal": "निजी वेबसाइट",
  "by": "प्रकाशक",
  "personalPages": "निजी पेज",
  "moreCategories": "अन्य श्रेणियाँ",
  "all": "सभी",
  "categoriesLabel": "उपयोग के अनुसार श्रेणियाँ",
  "categories": {
    "websites": "वेबसाइटें",
    "tools": "टूल",
    "apps": "ऐप"
  },
  "entrances": {
    "websites": {
      "title": "वेबसाइटें",
      "description": "निजी वेबसाइटें, पोर्टफ़ोलियो और प्रोजेक्ट के पेज।",
      "action": "वेबसाइटें देखें"
    },
    "tools": {
      "title": "टूल",
      "description": "मीडिया डाउनलोड और सबटाइटल जैसे कामों के लिए उपयोगी टूल।",
      "action": "टूल देखें"
    },
    "apps": {
      "title": "ऐप",
      "description": "पूरे ऐप, जिनमें AppAI की समीक्षा से गुज़रे ऐप भी शामिल हैं।",
      "action": "ऐप देखें"
    }
  }
},
};

export function getDirectoryCopy(locale: string): Copy {
  return COPY[locale] ?? COPY.en;
}
