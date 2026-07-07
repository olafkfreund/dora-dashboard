CREATE TABLE "gitlab_deployment" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"deploymentId" integer NOT NULL,
	"projectPath" text,
	"environment" text,
	"status" text,
	"ref" text,
	"sha" text,
	"createdAt" timestamp,
	"finishedAt" timestamp,
	"ingestedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gitlab_merge_request" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"iid" integer NOT NULL,
	"projectPath" text,
	"createdAt" timestamp,
	"mergedAt" timestamp,
	"ingestedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"entity" text NOT NULL,
	"cursor" text,
	"lastSyncAt" timestamp,
	"lastError" text,
	"itemCount" integer DEFAULT 0 NOT NULL
);
