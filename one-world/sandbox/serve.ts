import { serve } from 'bun';
import homepage from './index.html';
import { readFile } from 'fs/promises';

const port = 4141;

serve({
    routes: {
        '/': homepage,
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
