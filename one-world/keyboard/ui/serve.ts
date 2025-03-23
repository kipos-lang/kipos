import { unlinkSync, watch } from 'fs';
import { join } from 'path';

const bounce = (time: number, fn: () => unknown) => {
    let wait: null | Timer = null;
    return () => {
        if (wait != null) clearTimeout(wait);
        wait = setTimeout(() => fn(), time);
    };
};

let edited: string[] = [];
const rebuild = bounce(10, () => {
    console.log('rebuilding for', edited);
    edited = [];
    Promise.all([
        // Bun.build({
        //     entrypoints: ['./one-world/client/cli/worker.ts'],
        //     outdir: './',
        //     naming: 'worker.js',
        // }),
        Bun.build({
            entrypoints: ['./run.tsx'],
            outdir: './',
            naming: 'run.js',
        }),
    ])
        .then(([one]) => {
            if (!one.success) {
                unlinkSync('./run.js');
                throw new Error('build failureeee');
            }
            console.log('rebuilt successfully');
        })
        .catch((err) => {
            console.log('failed? idk');
        });
});

const service = Bun.serve({
    port: 3155,
    async fetch(req) {
        let pathname = new URL(req.url).pathname;
        if (pathname === '/') {
            pathname = '/index.html';
        }
        const file = Bun.file(join('.', pathname));
        return new Response(file);
    },
});

const ignore = ['.git/', 'node_modules/', '.ow-data/', '.cli.sess', 'worker.js', 'run.js', 'keyboard/ui/run.js'];

watch('../..', { recursive: true }, (event, filename) => {
    if (ignore.some((n) => filename!.startsWith(n))) {
        // ignore
        return;
    }
    if (filename!.match(/\.tsx?$/)) {
        edited.push(filename!);
        rebuild();
    } else {
        console.log('ignore', filename);
    }
});

rebuild();

console.log(`Serving http://${service.hostname}:${service.port}`);
