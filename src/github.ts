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
type DownloadArtifactParam =
  RestEndpointMethodTypes["actions"]["downloadArtifact"]["parameters"];
type DownloadArtifactResponse =
  RestEndpointMethodTypes["actions"]["downloadArtifact"]["response"];

export type WorkflowArtifact =
  RestEndpointMethodTypes["actions"]["listWorkflowRunArtifacts"]["response"]["data"]["artifacts"][0];

export type WorkflowArtifactMap = {
  [key: string]: WorkflowArtifact | undefined;
};

export type WorkflowRunJobs = {
  workflowRun: WorkflowRun;
  jobs: WorkflowRunJob[];
  workflowRunArtifacts: WorkflowArtifactMap;
};

// async function downloadArtifact(
//   context: Context,
//   octokit: InstanceType<typeof GitHub>,
//   artifact: WorkflowArtifact
// ) {
//   const artifactResponse = await octokit.rest.actions.downloadArtifact({
//     ...context.repo,
//     artifact_id: artifact.id,
//     archive_format: "zip",
//   });

// }
async function listWorkflowRunArtifacts(
  context: Context,
  octokit: InstanceType<typeof GitHub>,
  runId: number
): Promise<WorkflowArtifactMap> {
  const artifactsList: WorkflowArtifact[] = [];
  const pageSize = 100;

  for (let page = 1, hasNext = true; hasNext; page++) {
    const listArtifactsResponse =
      await octokit.rest.actions.listWorkflowRunArtifacts({
        ...context.repo,
        run_id: runId,
        page,
        per_page: pageSize,
      });
    artifactsList.push(...listArtifactsResponse.data.artifacts);
    hasNext = artifactsList.length < listArtifactsResponse.data.total_count;
  }
  return artifactsList.reduce(
    (result, item) => ({
      ...result,
      [item.name]: {
        ...item,
      },
    }),
    {}
  );
}

async function listJobsForWorkflowRun(
  context: Context,
  octokit: InstanceType<typeof GitHub>,
  runId: number
): Promise<WorkflowRunJob[]> {
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

  return jobs;
}

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

  const workflowRunArtifacts = await listWorkflowRunArtifacts(
    context,
    octokit,
    runId
  );
  const jobs = await listJobsForWorkflowRun(context, octokit, runId);

  const workflowRunJobs = {
    workflowRun: getWorkflowRunResponse.data,
    jobs,
    workflowRunArtifacts,
  };
  return workflowRunJobs;
}
