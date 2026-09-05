import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const output = join(tmpdir(), `koto-cdk-synth-${Date.now()}`);
const cdkCli = join(process.cwd(), "node_modules", "aws-cdk", "bin", "cdk");
const result = spawnSync(process.execPath, [cdkCli, "synth", "--output", output], { stdio: "inherit", shell: false });

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
