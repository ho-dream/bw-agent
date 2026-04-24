import { $ } from "bun";

type CommitType =
  | "feat"
  | "fix"
  | "docs"
  | "style"
  | "refactor"
  | "perf"
  | "test"
  | "build"
  | "ci"
  | "chore"
  | "revert";

interface CommitOptions {
  type: CommitType;
  scope?: string;
  breaking?: boolean;
  description: string;
  body?: string;
  footer?: string;
  dryRun?: boolean;
}

function buildMessage(opts: CommitOptions): string {
  const scope = opts.scope ? `(${opts.scope})` : "";
  const bang = opts.breaking ? "!" : "";
  const subject = `${opts.type}${scope}${bang}: ${opts.description}`;
  const parts = [subject];
  if (opts.body) parts.push("", opts.body);
  if (opts.footer) parts.push("", opts.footer);
  return parts.join("\n");
}

async function stagedDiff(): Promise<string> {
  const proc = Bun.spawn(["git", "diff", "--staged"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out;
}

async function unstagedDiff(): Promise<string> {
  const proc = Bun.spawn(["git", "diff"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out;
}

async function status(): Promise<string> {
  const proc = Bun.spawn(["git", "status", "--porcelain"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out;
}

async function stageFiles(files: string[]): Promise<void> {
  if (files.length === 0) return;
  const proc = Bun.spawn(["git", "add", ...files], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
}

async function commit(message: string): Promise<{ ok: boolean; output: string }> {
  const proc = Bun.spawn(["git", "commit", "-m", message], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  return { ok: code === 0, output: stdout + stderr };
}

function parseArgs(args: string[]): Partial<CommitOptions> & { files?: string[] } {
  const result: Partial<CommitOptions> & { files?: string[] } = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--type" || arg === "-t") {
      result.type = args[++i] as CommitType;
    } else if (arg === "--scope" || arg === "-s") {
      result.scope = args[++i];
    } else if (arg === "--breaking" || arg === "-b") {
      result.breaking = true;
    } else if (arg === "--description" || arg === "-d") {
      result.description = args[++i];
    } else if (arg === "--body") {
      result.body = args[++i];
    } else if (arg === "--footer") {
      result.footer = args[++i];
    } else if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--stage" || arg === "-S") {
      result.files = (result.files ?? []).concat(args[++i].split(","));
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  if (positional.length > 0 && !result.description) {
    result.description = positional.join(" ");
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: bun scripts/commit.ts [options]

Options:
  -t, --type <type>         Commit type (feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)
  -s, --scope <scope>       Optional scope
  -b, --breaking            Mark as breaking change
  -d, --description <desc>  Short description (<72 chars)
  --body <body>             Optional body text
  --footer <footer>         Optional footer
  -S, --stage <files>       Comma-separated files to stage before commit
  --dry-run                 Print message without committing
  -h, --help                Show this help

Examples:
  bun scripts/commit.ts -t feat -s auth -d "add login flow"
  bun scripts/commit.ts -t fix -d "resolve null pointer" --body "Fixes edge case when input is empty" --footer "Closes #42"
  bun scripts/commit.ts --dry-run -t refactor -d "extract utils"
`);
    return;
  }

  if (args[0] === "diff") {
    const staged = await stagedDiff();
    if (staged) {
      console.log(staged);
    } else {
      console.log(await unstagedDiff());
    }
    return;
  }

  if (args[0] === "status") {
    console.log(await status());
    return;
  }

  const opts = parseArgs(args);

  if (!opts.type || !opts.description) {
    console.error("Error: --type and --description are required");
    process.exit(1);
  }

  if (opts.files && opts.files.length > 0) {
    await stageFiles(opts.files);
  }

  const message = buildMessage(opts as CommitOptions);

  if (opts.dryRun) {
    console.log("--- dry run ---");
    console.log(message);
    console.log("--- end ---");
    return;
  }

  const result = await commit(message);
  if (result.ok) {
    console.log(result.output);
  } else {
    console.error(result.output);
    process.exit(1);
  }
}

main();
