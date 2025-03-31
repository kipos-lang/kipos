const basedir = '/Users/jared/clone/talks/hindley/demo';
import { dirname, join } from 'path';
import data from './tinference.json';

import fs, { existsSync } from 'fs';
import { execSync } from 'child_process';
// fs.mkdirSync("one-world/keyboard/ui", { recursive: true });
const tests = {};

const findDeps = (file: string) => {
    console.log(`finding deps for ${file}`);
    const full = JSON.parse(execSync(`npx madge ${file} --json`, { encoding: 'utf8' }));
    console.log(`Found ${Object.keys(full).length} deps`);
    return Object.keys(full);
};

const seen: Record<string, true> = {};
Object.keys(data).forEach((name) => {
    // const parent = dirname(name);
    // if (seen[parent]) return;
    // if (parent.startsWith('../../../')) return; // outside of one-world
    // seen[parent] = true;
    // const tests = fs.readdirSync(`${basedir}/${parent}`).filter((n) => n.endsWith('.test.ts'));
    // tests.forEach((name) => {
    //     console.log('dest', name);
    //     const dest = `one-world/keyboard/ui/${parent}/${name}`;
    //     const deps = findDeps(`${basedir}/${parent}/${name}`);
    //     deps.forEach((dep) => {
    //         const orig = `${basedir}/${parent}/${dep}`;
    //         const dest = `one-world/keyboard/ui/${parent}/${dep}`;
    //         if (!existsSync(dest)) {
    //             fs.mkdirSync(dirname(dest), { recursive: true });
    //             fs.copyFileSync(orig, dest);
    //         }
    //     });
    //     fs.mkdirSync(dirname(dest), { recursive: true });
    //     fs.copyFileSync(`${basedir}/${parent}/${name}`, dest);
    // });
    const dest = `type-inference-debugger/demo/${name}`;
    if (!existsSync(dest)) {
        fs.mkdirSync(dirname(dest), { recursive: true });
        fs.copyFileSync(`${basedir}/${name}`, dest);
    }
});
