import { submitFeedback } from "@/lib/feedback";
import { feedbackDeps } from "@/lib/feedback-server";
export async function POST(request: Request) {
  return submitFeedback(request, "agent", feedbackDeps);
}
