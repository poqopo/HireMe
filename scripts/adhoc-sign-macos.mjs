import { execFile as execFileCallback } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export default async function adHocSignMacApp(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = join(context.appOutDir, `${appName}.app`);
  await access(appPath);
  await execFile("codesign", [
    "--force",
    "--deep",
    "--sign",
    "-",
    "--timestamp=none",
    appPath,
  ]);
}
