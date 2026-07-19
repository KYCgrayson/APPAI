export const LOOKUP_KINDS = ["customer", "job-site", "item"] as const;
export type LookupKind = (typeof LOOKUP_KINDS)[number];

export interface CustomerLookupResult {
  kind: "customer";
  id: string;
  customerCode: string;
  name: string;
  phone?: string;
  address?: string;
}

export interface JobSiteLookupResult {
  kind: "job-site";
  id: string;
  name: string;
  address?: string;
  keyword?: string;
  monthlyCode?: string;
}

export interface ItemLookupResult {
  kind: "item";
  id: string;
  itemCode: string;
  canonicalName: string;
  material?: string;
  dimensionLabel?: string;
  defaultUnit?: string;
}

export type LookupResult = CustomerLookupResult | JobSiteLookupResult | ItemLookupResult;

export interface LookupResponse {
  items: LookupResult[];
  nextCursor: string | null;
  available: boolean;
  message: string;
}

export function isLookupKind(value: string): value is LookupKind {
  return (LOOKUP_KINDS as readonly string[]).includes(value);
}
