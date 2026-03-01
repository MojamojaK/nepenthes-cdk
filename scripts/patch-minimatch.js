// Patches the bundled minimatch in aws-cdk-lib to fix ReDoS vulnerabilities
// GHSA-7r86-cg39-jmmj and GHSA-23c5-xmqv-rm74 (affects minimatch 10.0.0–10.2.2)
// Remove this script once aws-cdk-lib ships with minimatch >= 10.2.3

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PATCHED_VERSION = "10.2.4";
const bundledDir = path.join(
  __dirname,
  "..",
  "node_modules",
  "aws-cdk-lib",
  "node_modules",
  "minimatch"
);

if (!fs.existsSync(bundledDir)) {
  process.exit(0);
}

const pkg = JSON.parse(
  fs.readFileSync(path.join(bundledDir, "package.json"), "utf8")
);

const [major, minor, patch] = pkg.version.split(".").map(Number);
if (major > 10 || (major === 10 && minor > 2) || (major === 10 && minor === 2 && patch >= 3)) {
  process.exit(0);
}

console.log(
  `Patching bundled minimatch ${pkg.version} -> ${PATCHED_VERSION} in aws-cdk-lib`
);

const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "minimatch-"));
try {
  execSync(`npm pack minimatch@${PATCHED_VERSION} --pack-destination ${tmpDir}`, {
    stdio: "pipe",
  });
  const tgz = path.join(tmpDir, `minimatch-${PATCHED_VERSION}.tgz`);
  execSync(
    `tar xzf ${tgz} -C ${bundledDir} --strip-components=1 --exclude='src'`,
    { stdio: "pipe" }
  );
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

const patched = JSON.parse(
  fs.readFileSync(path.join(bundledDir, "package.json"), "utf8")
);
console.log(`minimatch patched to ${patched.version}`);
