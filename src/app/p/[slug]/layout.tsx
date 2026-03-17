export default function HostedPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No AppAI header/footer — this looks like the user's own site
  return <>{children}</>;
}
