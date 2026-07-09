-- Program Increment becomes multi-value (text[]): an issue can belong to several PIs
-- and each membership is counted separately. Existing single values are wrapped as a
-- one-element array; the next Jira sync repopulates the full membership from the API.
ALTER TABLE "jira_issue" ALTER COLUMN "programIncrement" SET DATA TYPE text[]
  USING (CASE WHEN "programIncrement" IS NULL THEN NULL ELSE ARRAY["programIncrement"] END);
