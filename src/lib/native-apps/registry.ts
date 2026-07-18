export const NATIVE_APP_DEFINITIONS = {
  simpleshop: {
    type: "simpleshop",
    name: "Simpleshop",
    displayName: "Simpleshop 店務管理",
    runtimePath: "/app/simpleshop",
    requiresLogin: true,
    description: "以店家為單位管理出貨、月結與客戶聯繫的 AppAI 原生應用。",
    version: "1.0.0-phase1",
    category: "COMMERCE",
  },
} as const;

export type NativeAppType = keyof typeof NATIVE_APP_DEFINITIONS;
export type NativeAppDefinition = (typeof NATIVE_APP_DEFINITIONS)[NativeAppType];

export function isNativeAppType(value: string): value is NativeAppType {
  return Object.prototype.hasOwnProperty.call(NATIVE_APP_DEFINITIONS, value);
}

export function getNativeAppDefinition(value: string): NativeAppDefinition | null {
  return isNativeAppType(value) ? NATIVE_APP_DEFINITIONS[value] : null;
}

export function listNativeAppDefinitions(): NativeAppDefinition[] {
  return Object.values(NATIVE_APP_DEFINITIONS);
}
