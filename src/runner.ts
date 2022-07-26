import * as github from "@actions/github";
import * as core from "@actions/core";

import { getWorkflowRunJobs } from "./github";
import { createTracerProvider, traceWorkflowRunJobs } from "./tracing";

export async function run() {
  const ghContext = github.context;
  const otlpEndpoint = core.getInput("otlpEndpoint");
  const otlpHeaders = core.getInput("otlpHeaders");
  const devMode = core.getInput("devMode") === "true";
  const runId = parseInt(core.getInput("runId") || `${ghContext.runId}`);
  const ghToken =
    core.getInput("githubToken") || process.env.GITHUB_TOKEN || "";
  const octokit = github.getOctokit(ghToken);

  core.info(`Get Workflow Run Jobs for ${runId}`);
  const workflowRunJobs = await getWorkflowRunJobs(ghContext, octokit, runId);

  core.info(`Create Trace Provider for ${otlpEndpoint}`);

  const provider = createTracerProvider(
    otlpEndpoint,
    otlpHeaders,
    workflowRunJobs,
    devMode
  );

  try {
    core.info(
      `Trace Workflow Run Jobs for ${runId} and export to ${otlpEndpoint}`
    );
    const spanContext = await traceWorkflowRunJobs({
      provider,
      workflowRunJobs,
    });
    core.setOutput("traceId", spanContext.traceId);
  } finally {
    core.info("Shutdown Trace Provider");
    setTimeout(() => {
      provider
        .shutdown()
        .then(() => {
          core.info("Provider shutdown");
        })
        .catch((error: Error) => {
          console.warn(error.message);
        });
    }, 2000);
  }
}
