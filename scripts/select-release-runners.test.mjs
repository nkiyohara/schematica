/* eslint-disable @typescript-eslint/no-floating-promises */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findAvailableRunner,
  normalizeMode,
  selectReleaseRunners,
} from "./select-release-runners.mjs";

const linuxRunner = {
  name: "schematica-linux",
  status: "online",
  busy: false,
  labels: ["self-hosted", "schematica-release", "schematica-linux-x64"],
};

const macosRunner = {
  name: "schematica-mac",
  status: "online",
  busy: false,
  labels: ["self-hosted", "schematica-release", "schematica-macos-arm64"],
};

describe("select release runners", () => {
  it("uses hosted runners when hosted mode is requested", () => {
    const plan = selectReleaseRunners({ mode: "hosted", runners: [linuxRunner] });

    assert.equal(plan.targets.qa.kind, "hosted");
    assert.equal(plan.targets.qa.runsOn, "ubuntu-latest");
    assert.equal(plan.targets.macos.runsOn, "macos-latest");
  });

  it("prefers idle online self-hosted runners in auto mode", () => {
    const plan = selectReleaseRunners({ mode: "auto", runners: [linuxRunner, macosRunner] });

    assert.equal(plan.targets.qa.kind, "self-hosted");
    assert.equal(plan.targets.linux.runnerName, "schematica-linux");
    assert.equal(plan.targets.macos.runnerName, "schematica-mac");
    assert.equal(plan.targets.windows.kind, "hosted");
  });

  it("does not use busy self-hosted runners in auto mode", () => {
    const plan = selectReleaseRunners({
      mode: "auto",
      runners: [{ ...linuxRunner, busy: true }],
    });

    assert.equal(plan.targets.linux.kind, "hosted");
  });

  it("fails strict self-hosted mode when a required runner is unavailable", () => {
    assert.throws(
      () =>
        selectReleaseRunners({
          mode: "self-hosted",
          runners: [linuxRunner],
          requireSelfHosted: true,
        }),
      /schematica-macos-arm64/,
    );
  });

  it("matches runners by all labels", () => {
    assert.equal(
      findAvailableRunner(
        [linuxRunner],
        ["self-hosted", "schematica-release", "schematica-linux-x64"],
      )?.name,
      "schematica-linux",
    );
  });

  it("rejects unsupported modes", () => {
    assert.throws(() => normalizeMode("sometimes"), /Unsupported release runner mode/);
  });
});
