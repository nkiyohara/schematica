#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const hostedTargets = {
  qa: "ubuntu-latest",
  macos: "macos-latest",
  linux: "ubuntu-latest",
  windows: "windows-latest",
  cli: "ubuntu-latest",
};

const selfHostedTargets = {
  qa: ["self-hosted", "schematica-release", "schematica-linux-x64"],
  macos: ["self-hosted", "schematica-release", "schematica-macos-arm64"],
  linux: ["self-hosted", "schematica-release", "schematica-linux-x64"],
  windows: ["self-hosted", "schematica-release", "schematica-windows-x64"],
  cli: ["self-hosted", "schematica-release", "schematica-linux-x64"],
};

const targetNames = Object.keys(hostedTargets);
const validModes = new Set(["auto", "hosted", "self-hosted"]);

export async function main({
  env = process.env,
  fetchImpl = globalThis.fetch,
  stdout = process.stdout,
} = {}) {
  const mode = normalizeMode(env.RELEASE_RUNNER_MODE ?? "auto");
  const repository = env.GITHUB_REPOSITORY;
  const token = env.RELEASE_RUNNER_TOKEN || env.GITHUB_TOKEN;

  const runnerInventory =
    mode === "hosted"
      ? { runners: [], available: false, warning: undefined }
      : await loadRunnerInventory({ repository, token, fetchImpl });

  const plan = selectReleaseRunners({
    mode,
    runners: runnerInventory.runners,
    requireSelfHosted: mode === "self-hosted" && runnerInventory.available,
  });

  if (runnerInventory.warning) {
    plan.warnings.push(runnerInventory.warning);
  }

  writeOutputs(plan, env.GITHUB_OUTPUT);
  writeSummary(plan, env.GITHUB_STEP_SUMMARY);
  stdout.write(`${formatPlan(plan)}\n`);
}

export function normalizeMode(mode) {
  if (validModes.has(mode)) return mode;
  throw new Error(`Unsupported release runner mode: ${mode}`);
}

export function selectReleaseRunners({ mode, runners = [], requireSelfHosted = false }) {
  const plan = {
    mode,
    targets: {},
    warnings: [],
  };

  for (const targetName of targetNames) {
    const selfHosted = selfHostedTargets[targetName];
    const hosted = hostedTargets[targetName];
    const availableRunner = findAvailableRunner(runners, selfHosted);

    if (mode === "hosted") {
      plan.targets[targetName] = createTarget(hosted, "hosted");
      continue;
    }

    if (mode === "self-hosted") {
      if (requireSelfHosted && !availableRunner) {
        throw new Error(`No idle online self-hosted runner has labels: ${selfHosted.join(", ")}`);
      }
      plan.targets[targetName] = createTarget(selfHosted, "self-hosted", availableRunner);
      continue;
    }

    plan.targets[targetName] = availableRunner
      ? createTarget(selfHosted, "self-hosted", availableRunner)
      : createTarget(hosted, "hosted");
  }

  return plan;
}

export function findAvailableRunner(runners, requiredLabels) {
  return runners.find((runner) => {
    const labels = new Set(runner.labels ?? []);
    return (
      runner.status === "online" &&
      runner.busy === false &&
      requiredLabels.every((label) => labels.has(label))
    );
  });
}

async function loadRunnerInventory({ repository, token, fetchImpl }) {
  if (!repository) {
    return {
      runners: [],
      available: false,
      warning: "GITHUB_REPOSITORY is not set; falling back to hosted runners for auto mode.",
    };
  }

  if (!token) {
    return {
      runners: [],
      available: false,
      warning:
        "No GitHub token is available to inspect self-hosted runners; falling back to hosted runners for auto mode.",
    };
  }

  const url = `https://api.github.com/repos/${repository}/actions/runners?per_page=100`;
  const response = await fetchImpl(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  });

  if (!response.ok) {
    return {
      runners: [],
      available: false,
      warning: `Could not inspect self-hosted runners (${response.status} ${response.statusText}); falling back to hosted runners for auto mode.`,
    };
  }

  const body = await response.json();
  return {
    runners: (body.runners ?? []).map((runner) => ({
      name: runner.name,
      status: runner.status,
      busy: runner.busy,
      labels: (runner.labels ?? []).map((label) => label.name),
    })),
    available: true,
    warning: undefined,
  };
}

function createTarget(runsOn, kind, runner) {
  return {
    runsOn,
    kind,
    runnerName: runner?.name,
  };
}

function writeOutputs(plan, outputPath) {
  if (!outputPath) return;

  const lines = [];
  for (const targetName of targetNames) {
    const target = plan.targets[targetName];
    lines.push(`${targetName}_runs_on=${JSON.stringify(target.runsOn)}`);
    lines.push(`${targetName}_runner_kind=${target.kind}`);
  }
  lines.push(`runner_mode=${plan.mode}`);
  appendFileSync(outputPath, `${lines.join("\n")}\n`);
}

function writeSummary(plan, summaryPath) {
  if (!summaryPath) return;

  appendFileSync(
    summaryPath,
    [
      "## Release runner plan",
      "",
      `Mode: \`${plan.mode}\``,
      "",
      "| Job | Runner |",
      "| --- | --- |",
      ...targetNames.map((targetName) => {
        const target = plan.targets[targetName];
        const label = Array.isArray(target.runsOn) ? target.runsOn.join(", ") : target.runsOn;
        const runner = target.runnerName ? ` (${target.runnerName})` : "";
        return `| ${targetName} | ${target.kind}: \`${label}\`${runner} |`;
      }),
      "",
      ...plan.warnings.map((warning) => `> ${warning}`),
      "",
    ].join("\n"),
  );
}

function formatPlan(plan) {
  const targets = targetNames
    .map((targetName) => {
      const target = plan.targets[targetName];
      const label = Array.isArray(target.runsOn) ? target.runsOn.join(", ") : target.runsOn;
      const runner = target.runnerName ? ` (${target.runnerName})` : "";
      return `${targetName}: ${target.kind} ${label}${runner}`;
    })
    .join("\n");
  const warnings = plan.warnings.map((warning) => `warning: ${warning}`).join("\n");
  return [targets, warnings].filter(Boolean).join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
