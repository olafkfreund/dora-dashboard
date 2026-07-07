CREATE TABLE "jira_issue" (
	"id" text PRIMARY KEY NOT NULL,
	"projectKey" text,
	"issueType" text,
	"status" text,
	"statusCategory" text,
	"storyPoints" double precision,
	"sprintId" integer,
	"createdAt" timestamp,
	"updatedAt" timestamp,
	"inProgressAt" timestamp,
	"resolvedAt" timestamp,
	"blockedSeconds" integer,
	"labels" jsonb,
	"ingestedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jira_sprint" (
	"id" integer PRIMARY KEY NOT NULL,
	"boardId" integer,
	"name" text,
	"state" text,
	"startDate" timestamp,
	"endDate" timestamp,
	"completeDate" timestamp,
	"ingestedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jira_transition" (
	"id" text PRIMARY KEY NOT NULL,
	"issueKey" text NOT NULL,
	"fromStatus" text,
	"toStatus" text,
	"at" timestamp,
	"ingestedAt" timestamp DEFAULT now() NOT NULL
);
