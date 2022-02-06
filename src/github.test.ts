import {
  listWorkflowRunArtifacts,
  WorkflowArtifact,
  WorkflowArtifactDownload,
} from "./github";
import { Octokit } from "@octokit/rest";
import { Context } from "@actions/github/lib/context";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import axios from "axios";
import fs from "fs";
import path from "path";
import { mock, mockDeep } from "jest-mock-extended";

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
              name: "{lint-and-test}{run tests}",
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
      "__assets__",
      "{lint-and-test}{run tests}.zip"
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
    const response = lookup("lint-and-test", "run tests");
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
    expect(subject.path).toEqual("{lint-and-test}{run tests}.log");
    expect(fs.existsSync(subject.path)).toBeTruthy();
  });
  it("test WorkflowArtifactDownload has data", () => {
    const data = fs.readFileSync(subject.path, { encoding: "utf8", flag: "r" });
    // expect(data.length).toBeGreaterThan(0);
    const lines = data.split("\n");
    expect(lines.length).toBeGreaterThan(1);
  });
});
