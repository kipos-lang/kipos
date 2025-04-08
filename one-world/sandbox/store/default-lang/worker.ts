// prevents TS errors
// declare var self: Worker;

import { Stmt, TopItem } from '../../../syntaxes/algw-s2-types';
import { Dependencies } from '../editorStore';
import { CompilerEvents, ParseKind } from '../language';
import { TInfo } from './default-lang';
import { DefaultCompiler } from './DefaultCompiler';

export type ToWorker<K extends keyof CompilerEvents> =
    | {
          type: 'load';
          module: string;
          deps: Dependencies;
          asts: Record<string, { kind: ParseKind; ast: TopItem }>;
          infos: Record<string, TInfo>;
      }
    | {
          type: 'listen';
          evt: K;
          args: CompilerEvents[K]['args'];
          id: string;
      }
    | { type: 'unlisten'; id: string; evt: K };

export type FromWorker<K extends keyof CompilerEvents> = {
    type: 'message';
    id: string;
    evt: K;
    data: CompilerEvents[K]['data'];
};

const compiler = new DefaultCompiler();

const send = <K extends keyof CompilerEvents>(msg: FromWorker<K>) => {
    postMessage(msg);
};

const listeners: { [key: string]: { [id: string]: () => void } } = {};

self.onmessage = <K extends keyof CompilerEvents>({ data }: MessageEvent<ToWorker<K>>) => {
    try {
        switch (data.type) {
            case 'load':
                compiler.loadModule(data.module, data.deps, data.asts, data.infos);
                break;
            case 'listen': {
                if (!listeners[data.evt]) listeners[data.evt] = {};
                listeners[data.evt][data.id] = compiler.listen(data.evt, data.args, (response) => {
                    send<K>({ type: 'message', evt: data.evt, id: data.id, data: response });
                });
                break;
            }
            case 'unlisten': {
                if (!listeners[data.evt]?.[data.id]) {
                    console.warn(`trying to unlisten something that doesn't exist`);
                    break;
                }
                listeners[data.evt][data.id]();
                delete listeners[data.evt][data.id];
                break;
            }
        }
    } catch (err) {
        console.warn(`worker error`);
        console.log(err);
    }
    // postMessage('world');
};
