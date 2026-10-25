// Puts a "Map Animation Studio" shortcut on the Windows desktop that starts the editor.
//   npm run shortcut
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.platform !== "win32") {
  console.log(`Desktop shortcuts are made on Windows. On this system run: ${path.join(root, "start-map-studio.sh")}`);
  process.exit(0);
}
const bat = path.join(root, "Start Map Studio.bat");
const ps = `
$desk = [Environment]::GetFolderPath('Desktop')
$s = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desk 'Map Animation Studio.lnk'))
$s.TargetPath = '${bat.replace(/'/g, "''")}'
$s.WorkingDirectory = '${root.replace(/'/g, "''")}'
$s.IconLocation = "$env:SystemRoot\\System32\\imageres.dll,1"
$s.Description = 'Map Animation Studio'
$s.Save()
Write-Output (Join-Path $desk 'Map Animation Studio.lnk')
`;
const out = execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], { encoding: "utf8" });
console.log(`Shortcut created: ${out.trim()}`);
