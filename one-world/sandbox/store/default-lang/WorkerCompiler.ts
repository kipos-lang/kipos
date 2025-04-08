import { genId } from '../../../keyboard/ui/genId';
import { RecNode } from '../../../shared/cnodes';
import { Stmt, TopItem } from '../../../syntaxes/algw-s2-types';
import { Dependencies } from '../editorStore';
import { Compiler, CompilerEvents, ParseKind } from '../language';
import { TInfo } from './default-lang';
import { FromWorker, ToWorker } from './worker';

export type CompilerListenersMap = { [K in keyof CompilerEvents]: Record<string, (data: CompilerEvents[K]['data']) => void> };

export class WorkerCompiler implements Compiler<TopItem, TInfo> {
    worker: Worker;
    listeners: CompilerListenersMap = { results: {}, viewSource: {}, failure: {} };

    constructor() {
        this.worker = new Worker('./worker.ts');
        this._listen();
    }

    monitorStuckness() {
        // how do we unstuck
    }

    _listen<K extends keyof CompilerEvents>() {
        this.worker.onmessage = ({ data }: MessageEvent<FromWorker<K>>) => {
            switch (data.type) {
                case 'message': {
                    if (!this.listeners[data.evt]?.[data.id]) {
                        console.warn(`got a message but no listener`, data.evt, data.id);
                        return;
                    }
                    this.listeners[data.evt][data.id](data.data);
                    break;
                }
            }
        };
    }

    send<K extends keyof CompilerEvents>(msg: ToWorker<K>) {
        this.worker.postMessage(msg);
    }

    loadModule(module: string, deps: Dependencies, asts: Record<string, { kind: ParseKind; ast: TopItem }>, infos: Record<string, TInfo>): void {
        this.send({ type: 'load', asts, infos, deps, module });
    }

    listen<K extends keyof CompilerEvents>(evt: K, args: CompilerEvents[K]['args'], fn: (data: CompilerEvents[K]['data']) => void): () => void {
        const id = genId();
        const map: Record<string, (fn: CompilerEvents[K]['data']) => void> = this.listeners[evt];
        map[id] = fn;
        this.send({ type: 'listen', args, evt, id });
        return () => {
            this.send({ type: 'unlisten', evt, id });
            delete map[id];
        };
    }

    input(
        inputId: string,
        value:
            | { type: 'int' | 'float'; value: number }
            | { type: 'text'; value: string }
            | { type: 'cst'; value: RecNode }
            | { type: 'boolean'; value: boolean },
    ): void {}
}
