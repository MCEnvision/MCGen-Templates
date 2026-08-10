import { mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { sha256 } from "./digest.js";
import {
  validateBuildContract,
  type BuildEvidence,
  type BuildRunnerContract,
  type CommandSpec,
} from "./phase5-contracts.js";

const execFileAsync = promisify(execFile);

async function directoryBytes(path: string): Promise<number> {
  let total = 0;
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) total += await directoryBytes(child);
    else if (entry.isFile()) total += (await stat(child)).size;
  }
  return total;
}

export type CommandExecution = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  diskBytes?: number;
  failureClass?: "deterministic" | "transient" | "policy" | "environment";
};

export type CommandExecutor = (
  command: CommandSpec,
  workDirectory: string,
  timeoutMs: number,
  maxOutputBytes: number,
) => Promise<CommandExecution>;

export const nodeCommandExecutor: CommandExecutor = async (
  command,
  workDirectory,
  timeoutMs,
  maxOutputBytes,
) => {
  const started = Date.now();
  try {
    const result = await execFileAsync(command.executable, [...command.args], {
      cwd: workDirectory,
      timeout: timeoutMs,
      maxBuffer: maxOutputBytes,
      shell: false,
      windowsHide: true,
    });
    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: Date.now() - started,
      diskBytes: await directoryBytes(workDirectory),
    };
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      code?: string | number;
      killed?: boolean;
      signal?: string;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };
    return {
      exitCode: typeof failure.code === "number" ? failure.code : null,
      stdout: String(failure.stdout ?? ""),
      stderr: String(failure.stderr ?? failure.message),
      durationMs: Date.now() - started,
      diskBytes: await directoryBytes(workDirectory).catch(() => 0),
      failureClass:
        failure.killed || failure.signal === "SIGTERM"
          ? "transient"
          : failure.code === "ENOENT"
            ? "environment"
            : "deterministic",
    };
  }
};

export type BuildRunRequest = {
  contract: BuildRunnerContract;
  workDirectory: string;
  startedAt: string;
  execute: CommandExecutor;
  wrapperPath?: string;
  verifyJava?: () => Promise<void>;
  requireExactToolchain?: boolean;
};

export type IsolatedWorkspace = {
  path: string;
  cleanup: () => Promise<void>;
};

export async function createIsolatedWorkspace(
  parentDirectory: string,
  prefix = "mcgen-build-",
): Promise<IsolatedWorkspace> {
  const parent = safeWorkDirectory(parentDirectory);
  await mkdir(parent, { recursive: true });
  const path = await mkdtemp(join(parent, prefix));
  return {
    path,
    cleanup: async () => {
      await rm(path, { recursive: true, force: false });
    },
  };
}

export function verifyJavaRuntime(
  expectedRuntime: number,
  versionOutput: string,
  expectedDistribution?: string,
  distributionOutput?: string,
): void {
  const version =
    /version\s+"([^"\s]+)"/u.exec(versionOutput)?.[1] ??
    /^(\S+)/u.exec(versionOutput.trim())?.[1];
  const parts = version?.split(".").map((value) => Number(value));
  const runtime = parts?.[0] === 1 ? parts[1] : parts?.[0];
  if (!Number.isInteger(runtime) || runtime !== expectedRuntime)
    throw new Error(`java runtime does not match profile ${expectedRuntime}`);
  if (
    expectedDistribution &&
    distributionOutput &&
    !distributionOutput
      .toLowerCase()
      .includes(expectedDistribution.toLowerCase())
  )
    throw new Error(
      `java distribution does not match profile ${expectedDistribution}`,
    );
}

export async function verifyJavaInstallation(input: {
  executable?: string;
  runtime: number;
  distribution?: string;
}): Promise<void> {
  const executable = input.executable ?? "java";
  const result = await nodeCommandExecutor(
    {
      executable,
      args: ["-version"],
      purpose: "static-validation",
    },
    process.cwd(),
    10_000,
    32 * 1024,
  );
  if (result.exitCode !== 0)
    throw new Error(`java executable could not be inspected ${executable}`);
  verifyJavaRuntime(
    input.runtime,
    `${result.stdout}\n${result.stderr}`,
    input.distribution,
    `${result.stdout}\n${result.stderr}`,
  );
}

export function verifyWrapperChecksum(expected: string, actual: string): void {
  if (
    !/^[a-f0-9]{64}$/u.test(expected) ||
    !/^[a-f0-9]{64}$/u.test(actual) ||
    expected !== actual
  )
    throw new Error("gradle or maven wrapper checksum does not match profile");
}

export async function verifyWrapperFile(
  wrapperPath: string,
  expected: string,
): Promise<void> {
  if (!isAbsolute(wrapperPath))
    throw new Error("wrapper path must be absolute");
  const bytes = await readFile(wrapperPath);
  verifyWrapperChecksum(expected, sha256(bytes));
}

function boundedOutput(value: string, maxBytes: number): string {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.byteLength <= maxBytes) return value;
  return `${bytes.subarray(0, maxBytes).toString("utf8")}\n[output truncated]`;
}

function commandArray(command: CommandSpec): readonly string[] {
  return [command.executable, ...command.args];
}

function canRetry(result: CommandExecution): boolean {
  return result.failureClass === "transient";
}

function outputBytes(result: CommandExecution): number {
  return (
    Buffer.byteLength(result.stdout, "utf8") +
    Buffer.byteLength(result.stderr, "utf8")
  );
}

function safeWorkDirectory(path: string): string {
  if (!isAbsolute(path))
    throw new Error("build work directory must be absolute");
  const directory = resolve(path);
  if (directory === "/" || /^[A-Za-z]:[\\/]?$/u.test(directory))
    throw new Error("build work directory is too broad");
  return directory;
}

export async function runBuild(
  request: BuildRunRequest,
): Promise<BuildEvidence> {
  const failures = validateBuildContract(request.contract);
  if (failures.length)
    throw new Error(`invalid build contract\n${failures.join("\n")}`);
  const workDirectory = safeWorkDirectory(request.workDirectory);
  if (request.requireExactToolchain && !request.wrapperPath)
    throw new Error("exact builds require a verified wrapper path");
  if (request.requireExactToolchain && !request.verifyJava)
    throw new Error("exact builds require a verified Java runtime");
  const workDirectoryPolicy: unknown = request.contract.workDirectoryPolicy;
  if (workDirectoryPolicy !== "isolated-clean")
    throw new Error("build work directory policy must be isolated-clean");
  if (request.wrapperPath)
    await verifyWrapperFile(
      request.wrapperPath,
      request.contract.wrapper.sha256,
    );
  if (request.verifyJava) await request.verifyJava();
  const executions: BuildEvidence["commands"][number][] = [];
  let status: BuildEvidence["status"] = "passed";
  let failureClass: BuildEvidence["failureClass"];
  for (const command of request.contract.commands) {
    let result: CommandExecution | undefined;
    let lastError: unknown;
    const attempts = request.contract.limits.retries + 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        result = await request.execute(
          command,
          workDirectory,
          request.contract.limits.timeoutMs,
          request.contract.limits.maxOutputBytes,
        );
      } catch (error) {
        lastError = error;
        if (attempt + 1 >= attempts) break;
        continue;
      }
      if (result.exitCode === 0 || !canRetry(result) || attempt + 1 >= attempts)
        break;
    }
    result ??= {
      exitCode: null,
      stdout: "",
      stderr:
        lastError instanceof Error ? lastError.message : String(lastError),
      durationMs: 0,
      failureClass: "environment",
    };
    const output = `${boundedOutput(result.stdout, request.contract.limits.maxOutputBytes)}\n${boundedOutput(result.stderr, request.contract.limits.maxOutputBytes)}`;
    executions.push({
      command: commandArray(command),
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      outputDigest: sha256(output),
      outputBytes: outputBytes(result),
      ...(result.diskBytes === undefined
        ? {}
        : { diskBytes: result.diskBytes }),
    });
    if (outputBytes(result) > request.contract.limits.maxOutputBytes) {
      status = "failed";
      failureClass = "policy";
      break;
    }
    if (
      result.diskBytes !== undefined &&
      result.diskBytes > request.contract.limits.maxDiskBytes
    ) {
      status = "failed";
      failureClass = "policy";
      break;
    }
    if (result.exitCode !== 0) {
      status = "failed";
      failureClass = result.failureClass ?? "deterministic";
      break;
    }
  }
  return {
    status,
    startedAt: request.startedAt,
    finishedAt: new Date().toISOString(),
    commands: executions,
    ...(failureClass ? { failureClass } : {}),
  };
}

export async function runBuildInIsolatedWorkspace(input: {
  parentDirectory: string;
  request: Omit<BuildRunRequest, "workDirectory">;
  prefix?: string;
}): Promise<BuildEvidence> {
  const workspace = await createIsolatedWorkspace(
    input.parentDirectory,
    input.prefix,
  );
  try {
    return await runBuild({
      ...input.request,
      workDirectory: workspace.path,
    });
  } finally {
    await workspace.cleanup();
  }
}

export async function runTupleBuild(input: {
  tupleStatus:
    | "verified"
    | "legacy-verified"
    | "discovered"
    | "blocked"
    | "failed"
    | "skipped"
    | "queued";
  rawOverride: boolean;
  request: BuildRunRequest;
}): Promise<BuildEvidence> {
  const now = new Date().toISOString();
  if (
    input.rawOverride ||
    input.tupleStatus === "blocked" ||
    input.tupleStatus === "skipped"
  ) {
    return {
      status: input.rawOverride ? "skipped" : "blocked",
      startedAt: input.request.startedAt,
      finishedAt: now,
      commands: [],
      failureClass: "policy",
    };
  }
  return runBuild(input.request);
}

export function rejectRawOverrideExecution(rawOverride: boolean): void {
  if (rawOverride)
    throw new Error("raw custom build content is never executable");
}
