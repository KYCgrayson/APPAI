import { PlatformHeader } from "@/components/PlatformHeader";

export default function DeviceAuthLayout({ children }: { children: React.ReactNode }) {
  return <><PlatformHeader pageLabel="deviceAuth" />{children}</>;
}
