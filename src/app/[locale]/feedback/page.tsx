import { getTranslations } from "next-intl/server";
import { PlatformFooter } from "@/components/PlatformFooter";
import { webFeedbackAvailable } from "@/lib/feedback";
import { FeedbackForm } from "./form";

export default async function FeedbackPage() {
  const t = await getTranslations("feedbackForm");
  const siteKey = process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY ? process.env.TURNSTILE_SITE_KEY : undefined;
  return <><main className="max-w-xl mx-auto px-6 py-16"><h1 className="text-3xl font-bold mb-4">{t("title")}</h1><p className="mb-8">{t("description")}</p>{webFeedbackAvailable(process.env) ? <FeedbackForm siteKey={siteKey} /> : <p role="status">Feedback temporarily unavailable — agents can use the API.</p>}</main><PlatformFooter /></>;
}
