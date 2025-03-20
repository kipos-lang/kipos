const basedir = "/Users/jared/clone/exploration/j3/one-world/keyboard/ui";
import { dirname, join } from "path";
import data from "./tocopy.json";

import fs, { existsSync } from "fs";
import { execSync } from "child_process";
// fs.mkdirSync("one-world/keyboard/ui", { recursive: true });
const tests = {};

const findDeps = (file: string) => {
    const full = JSON.parse(execSync(`npx madge ${file} --json`, { encoding: "utf8" }));
    return Object.keys(full);
};

const seen = {};
Object.keys(data).forEach((name) => {
    const parent = dirname(name);
    if (seen[parent]) return;
    seen[parent] = true;
    const tests = fs.readdirSync(parent).filter((n) => n.endsWith(".test.ts"));
    tests.forEach((name) => {
        const dest = `one-world/keyboard/ui/${parent}/${name}`;
        fs.mkdirSync(dirname(dest), { recursive: true });
        fs.copyFileSync(`${basedir}/${parent}/${name}`, dest);
        const deps = findDeps(`${basedir}/${parent}/${name}`);
        deps.forEach((dep) => {
            const orig = `${basedir}/${parent}/${dep}`;
            const dest = `one-world/keyboard/ui/${parent}/${dep}`;
            if (!existsSync(dest)) {
                fs.mkdirSync(dirname(dest), { recursive: true });
                fs.copyFileSync(orig, dest);
            }
        });
    });
    const dest = `one-world/keyboard/ui/${name}`;
    if (!existsSync(dest)) {
        fs.mkdirSync(dirname(dest), { recursive: true });
        fs.copyFileSync(`${basedir}/${name}`, dest);
    }
});
