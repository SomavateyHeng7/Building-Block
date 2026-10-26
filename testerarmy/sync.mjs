// `pnpm testerarmy:sync`: puts the tests in tests.mjs into a TesterArmy group, creating the missing ones and
// replacing the steps of those already there (matched by title). Tests in the group that aren't in tests.mjs are
// listed and left alone. Needs `ta auth` (or TESTERARMY_API_KEY), TESTERARMY_PROJECT_ID and TESTERARMY_GROUP_ID.
import { execFileSync } from "node:child_process";
import { tests } from "./tests.mjs";

const project = process.env.TESTERARMY_PROJECT_ID;
const group = process.env.TESTERARMY_GROUP_ID;
if (!project || !group) {
  console.error("Set TESTERARMY_PROJECT_ID and TESTERARMY_GROUP_ID first (see docs/15-testing-and-qa.md).");
  process.exit(1);
}

/** Runs `ta … --json`, sending `input` as JSON on stdin, and returns what it printed, parsed. */
function ta(args, input) {
  const out = execFileSync("ta", [...args, "--json"], {
    input: input === undefined ? undefined : JSON.stringify(input),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
  });
  return JSON.parse(out);
}

const listed = ta(["tests", "list", "--project", project, "--group", group, "--all"]);
// The list comes as an array or wrapped in an object, depending on the CLI version.
const rows = Array.isArray(listed) ? listed : (listed.tests ?? listed.data ?? listed.items ?? []);
const existing = new Map(rows.map((row) => [row.title, row.id]));

for (const test of tests) {
  const body = { ...test, platform: "web" };
  const id = existing.get(test.title);
  if (id) {
    ta(["tests", "update", id], body);
    console.log(`updated  ${test.title}`);
  } else {
    const made = ta(["tests", "create", "--project", project, "--group", group], body);
    console.log(`created  ${test.title}  ${made.id ?? made.test?.id ?? ""}`);
  }
}

const known = new Set(tests.map((test) => test.title));
for (const title of existing.keys()) if (!known.has(title)) console.log(`not in tests.mjs, left as it is: ${title}`);
