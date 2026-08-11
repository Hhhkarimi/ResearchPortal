import fs from "node:fs";

const report = JSON.parse(
  fs.readFileSync("data/generated/change-report.json", "utf8")
);

const changed = report.changed?.length ?? 0;
const added = report.new?.length ?? 0;
const failed = report.failed?.length ?? 0;

const meaningful = changed + added > 0;

if (!process.env.GITHUB_OUTPUT) {
  throw new Error("GITHUB_OUTPUT is not available.");
}

fs.appendFileSync(
  process.env.GITHUB_OUTPUT,
  [
    `meaningful=${meaningful}`,
    `changed=${changed}`,
    `new=${added}`,
    `failed=${failed}`,
    "",
  ].join("\n")
);

console.log({
  changed,
  new: added,
  failed,
  meaningful,
});
