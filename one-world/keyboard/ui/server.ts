import { unlinkSync, watch } from 'fs';
import { join } from 'path';

const bounce = (time: number, fn: () => unknown) => {
    let wait: null | Timer = null;
    return () => {
        if (wait != null) clearTimeout(wait);
        wait = setTimeout(() => fn(), time);
    };
};

export const serve = (config: { port: number; watch: string; outdir: string; entries: Record<string, string[]> }) => {
    let edited: string[] = [];
    const list = Object.entries(config.entries);
    const rebuild = bounce(10, () => {
        console.log('rebuilding for', edited);
        edited = [];
        Promise.all(
            list.map(([out, input]) =>
                Bun.build({
                    entrypoints: input,
                    outdir: config.outdir,
                    naming: out,
                }),
            ),
        )
            .then((results) => {
                for (let i = 0; i < results.length; i++) {
                    if (!results[i].success) {
                        unlinkSync(list[i][0]);
                        console.log(results[i].logs);
                        console.error(`Build failure`);
                    }
                }
                console.log('built');
            })
            .catch((err) => {
                console.error(err);
                console.log('failed? idk');
            });
    });

    const service = Bun.serve({
        port: config.port,
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

    watch(config.watch, { recursive: true }, (event, filename) => {
        if (ignore.some((n) => filename!.startsWith(n))) {
            // ignore
            return;
        }
        if (filename!.match(/\.tsx?$/)) {
            edited.push(filename!);
            rebuild();
            // } else {
            //     console.log('ignore', filename);
        }
    });

    rebuild();

    console.log(`Serving http://${service.hostname}:${service.port}`);
};
