function luminance(rgb: number[]): number {
  return rgb.reduce((sum, channel, index) => {
    const s = channel / 255;
    const linear = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

function readableLink(rgb: number[], dark: boolean): string {
  // Check the less forgiving alternating section/card background in each mode.
  const background = luminance(dark ? [31, 41, 55] : [249, 250, 251]);
  for (let weight = 100; weight >= 0; weight -= 5) {
    const mixed = rgb.map(channel => Math.round(channel * weight / 100 + (dark ? 255 : 0) * (100 - weight) / 100));
    const foreground = luminance(mixed);
    if ((Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) >= 4.5) {
      return `#${mixed.map(channel => channel.toString(16).padStart(2, "0")).join("")}`;
    }
  }
  return dark ? "#ffffff" : "#000000";
}

/** Match the publishing API's opaque hex colours; never accept arbitrary CSS. */
export function proseThemeVariables(themeColor: unknown) {
  if (typeof themeColor !== "string" || themeColor.length !== 7 || !/^#[0-9a-f]{6}$/i.test(themeColor)) return undefined;
  const rgb = [1, 3, 5].map(index => parseInt(themeColor.slice(index, index + 2), 16));
  return {
    "--page-theme": themeColor,
    "--page-theme-link-light": readableLink(rgb, false),
    "--page-theme-link-dark": readableLink(rgb, true),
  };
}
