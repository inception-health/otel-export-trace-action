import {
  listWorkflowRunArtifacts,
  WorkflowArtifactLookup,
  WorkflowArtifact,
  WorkflowArtifactDownload,
} from "./github";
import { Octokit } from "@octokit/rest";
import { Context } from "@actions/github/lib/context";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import axios, { AxiosResponse, AxiosResponseHeaders } from "axios";
import fs from "fs";
import path from "path";
import { mock, mockDeep } from "jest-mock-extended";
import JSZip from "jszip";

jest.mock("axios");

type ListWorkflowRunArtifactsResponse =
  RestEndpointMethodTypes["actions"]["listWorkflowRunArtifacts"]["response"];
type DownloadArtifactResponse =
  RestEndpointMethodTypes["actions"]["downloadArtifact"]["response"];

describe("listWorkflowRunArtifacts", () => {
  let mockContext: Context;
  let mockOctokit: Octokit;
  let subject: WorkflowArtifactDownload;

  beforeAll(async () => {
    mockContext = mockDeep<Context>();
    mockOctokit = mockDeep<Octokit>();
    const mockListWorkflowRunArtifacts = mockOctokit.rest.actions
      .listWorkflowRunArtifacts as jest.MockedFunction<
      typeof mockOctokit.rest.actions.listWorkflowRunArtifacts
    >;
    const mockDownloadArtifact = mockOctokit.rest.actions
      .downloadArtifact as jest.MockedFunction<
      typeof mockOctokit.rest.actions.downloadArtifact
    >;

    mockListWorkflowRunArtifacts.mockResolvedValue(
      mock<ListWorkflowRunArtifactsResponse>({
        data: {
          total_count: 1,
          artifacts: [
            mock<WorkflowArtifact>({
              id: 1,
              name: "{lint-and-format-check}{run tests}{junit}",
            }),
          ],
        },
      })
    );
    mockDownloadArtifact.mockResolvedValue(
      mock<DownloadArtifactResponse>({ url: "localhost" })
    );
    const filePath = path.join(
      __dirname,
      "tracing",
      "__assets__",
      "{lint-and-format-check}{run tests}{junit}.zip"
    );
    const zipFile = fs.readFileSync(filePath);
    (axios as jest.MockedFunction<typeof axios>).mockResolvedValue({
      data: zipFile,
      status: 200,
      headers: {},
      statusText: "OK",
      config: {},
    });
    const lookup = await listWorkflowRunArtifacts(mockContext, mockOctokit, 1);
    const response = lookup("lint-and-format-check", "run tests");
    if (!response) {
      fail("Lookup Failed: Did not parse zip file correctly");
    }
    subject = response;
  });

  afterAll(() => {
    if (subject?.path) {
      fs.unlinkSync(subject.path);
    }
  });

  it("test WorkflowArtifactDownload return to be defined", () => {
    expect(subject).toBeDefined();
  });

  it("test WorkflowArtifactDownload path exists", () => {
    expect(subject.path).toEqual(
      "{lint-and-format-check}{run tests}{junit}.xml"
    );
    expect(fs.existsSync(subject?.path)).toBeTruthy();
  });
});
