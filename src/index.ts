import { run } from "./runner";
import * as core from "@actions/core";

foo;

run().catch((error: Error) => {
  core.setFailed(error.message);
});
