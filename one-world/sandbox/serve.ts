import { serve } from '../keyboard/ui/server';

serve({
    port: 4141,
    watch: '../',
    outdir: './',
    entries: {
        'run.js': ['./run.tsx'],
    },
});
