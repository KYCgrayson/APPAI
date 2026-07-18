export const SIMPLESHOP_MODULES = {
  shipping: {
    title: "出貨管理",
    description: "建立出貨與退貨流程；Phase 1 先提供安全的操作入口與共用查詢骨架。",
    accent: "bg-cyan-500",
    primary: true,
  },
  statements: {
    title: "月結管理",
    description: "彙整出貨、退貨與應收；正式帳務規則將依 PRD 後續階段實作。",
    accent: "bg-violet-500",
    primary: true,
  },
  contacts: {
    title: "客戶聯繫",
    description: "管理客戶與工地聯繫脈絡；主檔 CRUD 將於 Phase 2 啟用。",
    accent: "bg-amber-500",
    primary: true,
  },
  items: {
    title: "品項與料號",
    description: "品項、別名、材質、尺寸與單位的後續管理入口。",
    accent: "bg-emerald-500",
    primary: false,
  },
  pricing: {
    title: "價格設定",
    description: "價格版本、客戶價與工地價將於主檔階段實作。",
    accent: "bg-rose-500",
    primary: false,
  },
  inventory: {
    title: "庫存",
    description: "庫存異動帳與盤點功能的預留入口。",
    accent: "bg-blue-500",
    primary: false,
  },
} as const;

export type SimpleshopModuleKey = keyof typeof SIMPLESHOP_MODULES;

export function isSimpleshopModule(value: string): value is SimpleshopModuleKey {
  return Object.prototype.hasOwnProperty.call(SIMPLESHOP_MODULES, value);
}
