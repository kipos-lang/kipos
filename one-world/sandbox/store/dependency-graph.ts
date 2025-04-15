// so ... I'm only thinking about a single module at this point.
export type ComponentsByModule = Record<string, Components>;

// Tarjan's algorithm
// https://www.baeldung.com/cs/scc-tarjans-algorithm
const findCycles = (graph: Record<string, string[]>) => {
    const num: Record<string, number> = {};
    const lowest: Record<string, number> = {};
    const visited: Record<string, true> = {};
    const processed: Record<string, true> = {};
    const s: string[] = [];
    let i = 0;

    const components: string[][] = [];

    // console.log(graph);
    Object.values(graph).forEach((d) => {
        d.forEach((d) => {
            if (!graph[d]) {
                // debugger;
                throw new Error(`unknown id in graph: ${d}`);
            }
        });
    });

    const dfs = (v: string) => {
        num[v] = i;
        lowest[v] = num[v];
        i++;
        visited[v] = true;
        s.push(v);

        graph[v].forEach((u) => {
            if (!visited[u]) {
                dfs(u);
                lowest[v] = Math.min(lowest[v], lowest[u]);
            } else if (!processed[u]) {
                lowest[v] = Math.min(lowest[v], num[u]);
            }
        });

        processed[v] = true;

        if (lowest[v] === num[v]) {
            let sccVertex = s.pop();
            if (!sccVertex) throw new Error(`ran out of stack`);
            const scc: string[] = [];
            while (sccVertex !== v) {
                scc.push(sccVertex);
                sccVertex = s.pop();
                if (!sccVertex) throw new Error(`ran out of stack`);
            }

            scc.push(sccVertex);
            components.push(scc);
        }
    };

    Object.keys(graph).forEach((k) => {
        if (!visited[k]) dfs(k);
    });

    return components;
};

// "Component" here as a "Strongly Connected Component" in a DAG
export type Components = {
    // mutual -> "cycle head"
    pointers: Record<string, string>;
    // id -> mutuals
    entries: Record<string, string[]>;
};

export const collapseComponents = (graph: Record<string, string[]>): Components => {
    const components = findCycles(graph);

    const pointers: Record<string, string> = {};
    const entries: Record<string, string[]> = {};

    components.forEach((component) => {
        component.sort();
        const first = component[0];
        component.forEach((id) => (pointers[id] = first));
        entries[first] = component;
    });

    return { pointers, entries };
};
