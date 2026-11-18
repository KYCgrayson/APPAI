import { directoryTileColors, firstGrapheme } from "@/lib/directory-logo";

export function DirectoryLogo({ name, logoUrl, themeColor }: {
  name: string; logoUrl?: string | null; themeColor?: string | null;
}) {
  if (logoUrl) {
    // Keep existing logo markup exactly as shipped; arbitrary publisher image hosts are supported.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={name} className="w-12 h-12 rounded-xl object-cover" />;
  }
  return (
    <div aria-hidden="true" className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center overflow-hidden text-lg font-bold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
      style={directoryTileColors(themeColor)}>
      {firstGrapheme(name)}
    </div>
  );
}
