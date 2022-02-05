import * as github from "@actions/github";
import * as core from "@actions/core";

import { getWorkflowRunJobs } from "./github";
import { createTracerProvider, traceWorkflowRunJobs } from "./tracing";

export async function run() {
  const ghContext = github.context;
  const otlpEndpoint = core.getInput("otlpEndpoint");
  const otlpHeaders = core.getInput("otlpHeaders");
  const runId = parseInt(core.getInput("runId") || `${ghContext.runId}`);
  const ghToken =
    core.getInput("githubToken") || process.env.GITHUB_TOKEN || "";
  const octokit = github.getOctokit(ghToken);

  console.log(`Get Workflow Run Jobs for ${runId}`);
  const workflowRunJobs = await getWorkflowRunJobs(ghContext, octokit, runId);

  console.log(`Create Trace Provider for ${otlpEndpoint}`);

  const provider = createTracerProvider(
    otlpEndpoint,
    otlpHeaders,
    workflowRunJobs
  );

  try {
    console.log(
      `Trace Workflow Run Jobs for ${runId} and export to ${otlpEndpoint}`
    );
    await traceWorkflowRunJobs({ provider, workflowRunJobs });
  } finally {
    console.log("Shutdown Trace Provider");
    setTimeout(() => {
      provider
        .shutdown()
        .then(() => {
          console.log("Provider shutdown");
        })
        .catch((error: Error) => {
          console.warn(error.message);
        });
    }, 2000);
  }
}
