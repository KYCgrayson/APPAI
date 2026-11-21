import LegacyRootLayout, { metadata } from "./(legacy)/layout";
import NotFound from "./(legacy)/not-found";

export { metadata };

export default function GlobalNotFound() {
  return <LegacyRootLayout><NotFound /></LegacyRootLayout>;
}
