ALTER TABLE "gitlab_merge_request" ADD COLUMN "mergeCommitSha" text;--> statement-breakpoint
ALTER TABLE "gitlab_merge_request" ADD COLUMN "firstCommitAt" timestamp;