import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { crc32, createZip } from "@/lib/zip";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("createZip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(bytes("123456789")).toString(16)).toBe("cbf43926");
  });

  it("writes a zip that standard tools read back intact, with UTF-8 names", () => {
    const zip = createZip([
      { name: "plan-current.png", data: new Uint8Array([137, 80, 78, 71, 0, 255]) },
      { name: "café-components.csv", data: bytes('"Section","Name"\r\n"Current","Orders"') },
    ]);
    const path = join(mkdtempSync(join(tmpdir(), "bb-zip-")), "export.zip");
    writeFileSync(path, zip);
    // Every entry's CRC checks out.
    expect(execFileSync("unzip", ["-t", path]).toString()).toMatch(/No errors detected/);
    // Names and contents, read by Python's zipfile, which honours the UTF-8 name flag (macOS's own
    // unzip is built without Unicode support and would show "café" garbled).
    const read = (script: string) => execFileSync("python3", ["-c", `import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); ${script}`, path]).toString();
    expect(read("print('|'.join(z.namelist()))").trim()).toBe("plan-current.png|café-components.csv");
    expect(read("sys.stdout.write(z.read('café-components.csv').decode())")).toBe('"Section","Name"\r\n"Current","Orders"');
  });

  it("writes a valid empty zip", () => {
    expect(createZip([])).toHaveLength(22);
  });
});
