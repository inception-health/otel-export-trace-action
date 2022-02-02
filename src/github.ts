import { Context } from "@actions/github/lib/context";
import { GitHub } from "@actions/github/lib/utils";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import axios from "axios";
import JSZip from "jszip";
import fs from "fs";

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
export type ListWorkflowRunArtifactsResponse =
  RestEndpointMethodTypes["actions"]["listWorkflowRunArtifacts"]["response"];

export type WorkflowArtifact =
  ListWorkflowRunArtifactsResponse["data"]["artifacts"][0];

export type WorkflowArtifactMap = {
  [job: string]: {
    [step: string]: WorkflowArtifactDownload;
  };
};

export type WorkflowArtifactDownload = {
  jobName: string;
  stepName: string;
  reportType: string;
  path: string;
};

export type WorkflowArtifactLookup = (
  jobName: string,
  stepName: string
) => WorkflowArtifactDownload | undefined;

export type WorkflowRunJobs = {
  workflowRun: WorkflowRun;
  jobs: WorkflowRunJob[];
  workflowRunArtifacts: WorkflowArtifactLookup;
};

export async function listWorkflowRunArtifacts(
  context: Context,
  octokit: InstanceType<typeof GitHub>,
  runId: number
): Promise<WorkflowArtifactLookup> {
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

  const artifactsLookup: WorkflowArtifactMap = await artifactsList.reduce(
    async (resultP, artifact) => {
      const result = await resultP;
      const match = artifact.name.match(
        /\{(?<jobName>.*)\}\{(?<stepName>.*)\}\{(?<reportType>.*)\}/
      );
      const next: WorkflowArtifactMap = { ...result };
      /* istanbul ignore next */
      if (
        match?.groups?.jobName &&
        match?.groups?.stepName &&
        match?.groups?.reportType
      ) {
        const { jobName, stepName, reportType } = match.groups;

        if (!(jobName in next)) {
          next[jobName] = {};
        }
        const downloadResponse = await octokit.rest.actions.downloadArtifact({
          ...context.repo,
          artifact_id: artifact.id,
          archive_format: "zip",
        });

        const response = await axios({
          method: "get",
          url: downloadResponse.url,
          responseType: "arraybuffer",
        });
        const buf = response.data as Buffer;
        const zip = await JSZip.loadAsync(buf);
        const writeStream = fs.createWriteStream(`${artifact.name}.xml`);
        zip.files[Object.keys(zip.files)[0]].nodeStream().pipe(writeStream);

        next[jobName][stepName] = {
          reportType,
          jobName,
          stepName,
          path: writeStream.path.toString(),
        };
      }

      return next;
    },
    Promise.resolve({})
  );

  return (jobName: string, stepName: string) => {
    try {
      return artifactsLookup[jobName][stepName];
    } catch (e) {
      /* istanbul ignore next */
      return undefined;
    }
  };
}

// TODO add test coverage
/* istanbul ignore next */
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

// TODO add test coverage
/* istanbul ignore next */
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
