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
    description: "管理客戶、工地、別名與每月流水號，保留後續聯繫脈絡。",
    accent: "bg-amber-500",
    primary: true,
  },
  items: {
    title: "品項與料號",
    description: "管理正式料號、別名、材質、尺寸、分類與換算單位。",
    accent: "bg-emerald-500",
    primary: false,
  },
  pricing: {
    title: "價格設定",
    description: "價格版本、進貨價、售價、客戶價與工地價的管理入口。",
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
