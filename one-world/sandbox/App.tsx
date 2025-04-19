import React, { useEffect, useMemo, useState } from 'react';
import { Editor } from './Editor';
import { ModuleSidebar } from './ModuleSidebar';
import { Store, StoreCtx } from './store/store';
import { Backend } from './store/versionings';
import { LS } from './store/backends/localStorage';
import { IGit } from './store/backends/igit';
import { defaultLang } from './store/default-lang/default-lang';
import { useHash } from '../useHash';
import { Project } from './store/storage';
import { genId } from '../keyboard/ui/genId';
import { css } from 'goober';
import { zedlight } from './zedcolors';

const parseHash = (hash: string) => {
    const parts = hash.split('::');
    let [backend, project, module] = parts;
    if (!backends[backend]) backend = '';
    return { backend, project, module };
};

export const Selector = ({ id, bend }: { id: string; bend: Backend }) => {
    const [projects, setProjects] = useState(null as null | Project[]);
    useEffect(() => {
        bend.listProjects().then(setProjects);
    }, [bend]);
    if (!projects) return 'loading project list';
    return (
        <div>
            <h3>Projects</h3>
            {projects.map((proj) => (
                <div>
                    <a
                        href={`#${id}::${proj.id}`}
                        className={css({
                            padding: '8px 16px',
                            display: 'block',
                            '&:hover': {
                                background: zedlight['border.disabled'],
                            },
                        })}
                    >
                        {proj.name}
                    </a>
                </div>
            ))}
            <button
                onClick={() => {
                    const pid = genId();
                    bend.createProject({ id: pid, created: Date.now(), name: `New Project`, opened: Date.now() }).then(() => {
                        location.hash = `#${id}::${pid}`;
                    });
                }}
            >
                New Project
            </button>
        </div>
    );
};

export const Loader = ({ children }: { children: React.ReactNode }) => {
    const [store, setStore] = useState(null as null | { store: Store });
    const hash = useHash();
    const loaded = parseHash(hash);

    const bend = useMemo(() => {
        if (!loaded.backend || !backends[loaded.backend]) return;
        return backends[loaded.backend].backend();
    }, [loaded.backend]);

    useEffect(() => {
        if (!bend || !loaded.project) return;
        bend?.loadProject(loaded.project).then(
            (modules) => {
                setStore({ store: new Store(loaded.project, modules, loaded.module, bend, { default: defaultLang }) });
            },
            (err) => {
                location.hash = '#' + loaded.backend;
            },
        );
    }, [bend, loaded.project]);

    useEffect(() => {
        if (!store || !loaded) return;
        store.store.select(loaded.module);
    }, [store, loaded.module]);

    useEffect(() => {
        if (!store) return;
        return store.store.listen('selected', () => {
            const loaded = parseHash(location.hash?.slice(1));
            if (store.store.selected !== loaded.module) {
                location.hash = `#${loaded.backend}::${loaded.project}::${store.store.selected}`;
            }
        });
    }, [store]);

    if (!bend) {
        return (
            <div>
                {Object.entries(backends).map(([id, { title }]) => (
                    <div key={id}>
                        <a
                            href={`#${id}`}
                            className={css({
                                padding: '8px 16px',
                                display: 'block',
                                '&:hover': {
                                    background: zedlight['border.disabled'],
                                },
                            })}
                        >
                            {title}
                        </a>
                    </div>
                ))}
            </div>
        );
    }

    if (!loaded.project) {
        return <Selector id={loaded.backend} bend={bend} />;
    }

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
            <Loader>
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
