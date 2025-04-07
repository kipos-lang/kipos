import { build, HTMLBundle, serve } from 'bun';
import homepage from './index.html';
// import worker from './store/default-lang/worker.html';
import { readFile } from 'fs/promises';

const port = 4141;

serve({
    routes: {
        '/': homepage,
        '/worker.ts': async () => {
            await build({
                entrypoints: ['./store/default-lang/worker.ts'],
                outdir: '.worker',
                naming: 'worker.js',
            });
            return new Response(await readFile('./.worker/worker.js'));
        },
        '/favicon.png': async () => new Response(await readFile('./favicon.png')),
        '/fonts/:name': async (req) => {
            const { name } = req.params;
            return new Response(await readFile('./fonts/' + name));
        },
    },
    development: true,
    port,
});
console.log(`http://localhost:${port}`);
