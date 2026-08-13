import {spawnSync} from "node:child_process";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const sourceRoot=path.join(projectRoot,"pipeline","src");
const incoming=process.argv.slice(2);
const testMode=incoming[0]==="--test";
const args=testMode
  ? ["-m","unittest","discover","-s",path.join(projectRoot,"pipeline","tests"),"-v"]
  : ["-m","research_portal_pipeline","--project-root",projectRoot,"--config",path.join(projectRoot,"pipeline","config","pipeline.toml"),...incoming];

const candidates=process.platform==="win32"
  ? [["py",["-3"]],["python",[]],["python3",[]]]
  : [["python3",[]],["python",[]]];
let lastError="Python 3.11+ was not found.";
for(const [executable,prefix] of candidates){
  const result=spawnSync(executable,[...prefix,...args],{
    cwd:projectRoot,
    env:{...process.env,PYTHONPATH:[sourceRoot,process.env.PYTHONPATH].filter(Boolean).join(path.delimiter)},
    stdio:"inherit",
  });
  if(result.error?.code==="ENOENT")continue;
  if(result.error){lastError=result.error.message;continue;}
  process.exit(result.status??1);
}
console.error(lastError);
process.exit(1);
