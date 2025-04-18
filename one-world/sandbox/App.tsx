import React, { useEffect, useMemo, useState } from 'react';
import { Editor } from './Editor';
import { ModuleSidebar } from './ModuleSidebar';
import { Store, StoreCtx } from './store/store';
import { Backend } from './store/versionings';
import { LS } from './store/backends/localStorage';
import { IGit } from './store/backends/igit';
import { defaultLang } from './store/default-lang/default-lang';

export const Loader = ({ children, backend, project }: { children: React.ReactNode; backend: Backend; project: string }) => {
    const [store, setStore] = useState(null as null | { store: Store });
    useEffect(() => {
        backend.loadProject(project).then((modules) => {
            setStore({ store: new Store(project, modules, location.hash.slice(1), backend, { default: defaultLang }) });
        });
    }, []);
    useEffect(() => {
        if (!store) return;
        const f = () => store.store.select(location.hash.slice(1));
        window.addEventListener('hashchange', f);

        return () => window.removeEventListener('hashchange', f);
    }, [store]);
    if (!store) return null;
    return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>;
};

const backends: Record<string, { title: string; backend: () => Backend }> = {
    ls: {
        title: 'LocalStorage',
        backend: () => new LS(),
    },
    igit: {
        title: 'Isomorphic Git',
        backend: () => IGit,
    },
};

export const App = () => {
    const backend = useMemo(() => new LS(), []);
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                height: '100vh',
                alignItems: 'stretch',
            }}
        >
            <Loader project="default" backend={backend}>
                <ModuleSidebar />
                <Editor />
            </Loader>
        </div>
    );
};

export const cursorPositionInSpanForEvt = (evt: React.MouseEvent, target: HTMLSpanElement, text: string[]) => {
    const range = new Range();
    let best = null as null | [number, number];
    for (let i = 0; i <= text.length; i++) {
        const at = text.slice(0, i).join('').length;
        range.setStart(target.firstChild!, at);
        range.setEnd(target.firstChild!, at);
        const box = range.getBoundingClientRect();
        if (evt.clientY < box.top || evt.clientY > box.bottom) continue;
        const dst = Math.abs(box.left - evt.clientX);
        if (!best || dst < best[0]) best = [dst, i];
    }
    return best ? best[1] : null;
};
