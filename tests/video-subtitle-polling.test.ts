import assert from "node:assert/strict";
import test from "node:test";

import {
  POLL_TIMEOUT_MS,
  STALE_AFTER_MS,
  isJobStalled,
  jobProgressKey,
  jobStatusUrl,
} from "../src/templates/shared/jobs/polling-policy.ts";

test("subtitle polling declares no meaningful progress stale after 90 seconds", () => {
  const startedAt = 10_000;
  assert.equal(isJobStalled(startedAt, startedAt + STALE_AFTER_MS - 1), false);
  assert.equal(isJobStalled(startedAt, startedAt + STALE_AFTER_MS), true);
  assert.equal(POLL_TIMEOUT_MS, 10_000);
});

test("progress keys change only when stage or percent advances", () => {
  const base = {
    id: "job-1",
    kind: "transcribe",
    status: "processing",
    created_at: "2026-08-14T00:00:00Z",
    expires_at: "2026-08-15T00:00:00Z",
  } as const;
  assert.equal(jobProgressKey({ ...base, progress: { stage: "transcribing", percent: 25 } }), "transcribing:25");
  assert.notEqual(
    jobProgressKey({ ...base, progress: { stage: "transcribing", percent: 25 } }),
    jobProgressKey({ ...base, progress: { stage: "transcribing", percent: 26 } }),
  );
});

test("check again targets the same encoded job resource", () => {
  assert.equal(
    jobStatusUrl("/api/connect/video-subtitle", "same job/id"),
    "/api/connect/video-subtitle/jobs/same%20job%2Fid",
  );
});
