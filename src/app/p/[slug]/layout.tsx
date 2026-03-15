export default function HostedPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No AIGA header/footer — this looks like the user's own site
  return <>{children}</>;
}
