import { AppLandingPage } from "../app-landing/AppLandingPage";
import { CompanyProfilePage } from "../company-profile/CompanyProfilePage";
import { LinkInBioPage } from "../link-in-bio/LinkInBioPage";

interface PageData {
  template: string;
  title: string;
  tagline?: string | null;
  heroImage?: string | null;
  content: any;
  themeColor?: string | null;
  customCss?: string | null;
}

export function PageRenderer({ page }: { page: PageData }) {
  const props = {
    title: page.title,
    tagline: page.tagline || undefined,
    heroImage: page.heroImage || undefined,
    content: page.content,
    themeColor: page.themeColor || "#000000",
  };

  switch (page.template) {
    case "APP_LANDING":
      return <AppLandingPage {...props} />;
    case "COMPANY_PROFILE":
      return <CompanyProfilePage {...props} />;
    case "LINK_IN_BIO":
      return <LinkInBioPage {...props} />;
    default:
      return <AppLandingPage {...props} />;
  }
}
