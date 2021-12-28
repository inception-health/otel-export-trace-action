import { run } from "./runner";
import * as core from "@actions/core";

run().catch((error: Error) => {
  core.setFailed(error.message);
});
