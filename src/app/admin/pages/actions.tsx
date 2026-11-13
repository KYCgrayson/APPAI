import { PageActionButtons } from "@/app/dashboard/pages/actions";
export function AdminPageActions({ pageId }: { pageId: string; slug: string; isPublished: boolean }) {
  return <PageActionButtons id={pageId} />;
}
