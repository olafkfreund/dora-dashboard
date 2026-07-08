CREATE TABLE "gitlab_incident" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"iid" integer NOT NULL,
	"projectPath" text,
	"state" text,
	"createdAt" timestamp,
	"closedAt" timestamp,
	"ingestedAt" timestamp DEFAULT now() NOT NULL
);
