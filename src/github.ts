import { Context } from "@actions/github/lib/context";
import { GitHub } from "@actions/github/lib/utils";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

export type OctoKit = InstanceType<typeof GitHub>;
export type GetWorkflowRunType =
  RestEndpointMethodTypes["actions"]["getWorkflowRun"]["response"];
export type ListJobsForWorkflowRunType =
  RestEndpointMethodTypes["actions"]["listJobsForWorkflowRun"]["response"];
export type WorkflowRunJob = ListJobsForWorkflowRunType["data"]["jobs"][0];
export type WorkflowRunJobStep = {
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null;
  name: string;
  number: number;
  started_at?: string | null | undefined;
  completed_at?: string | null | undefined;
};
export type WorkflowRun = GetWorkflowRunType["data"];

export type WorkflowRunJobs = {
  workflowRun: WorkflowRun;
  jobs: WorkflowRunJob[];
};

export async function getWorkflowRunJobs(
  context: Context,
  octokit: InstanceType<typeof GitHub>,
  runId: number
): Promise<WorkflowRunJobs> {
  const getWorkflowRunResponse: GetWorkflowRunType =
    await octokit.rest.actions.getWorkflowRun({
      ...context.repo,
      run_id: runId,
    });

  const jobs: WorkflowRunJob[] = [];
  const pageSize = 100;

  for (let page = 1, hasNext = true; hasNext; page++) {
    const listJobsForWorkflowRunResponse: ListJobsForWorkflowRunType =
      await octokit.rest.actions.listJobsForWorkflowRun({
        ...context.repo,
        run_id: runId,
        filter: "latest", // risk of missing a run if re-run happens between Action trigger and this query
        page,
        per_page: pageSize,
      });

    jobs.push(...listJobsForWorkflowRunResponse.data.jobs);
    hasNext = jobs.length < listJobsForWorkflowRunResponse.data.total_count;
  }
  const workflowRunJobs = { workflowRun: getWorkflowRunResponse.data, jobs };
  return workflowRunJobs;
}
