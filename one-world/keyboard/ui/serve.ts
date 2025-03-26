import { serve } from './server';

serve({
    watch: '../..',
    port: 3155,
    outdir: '.',
    entries: { 'run.js': ['./run.tsx'] },
});
