import React, { useState } from 'react';
import { useStore } from './store/store';
import { Import } from './types';

const ImportSource = ({ value, update }: { value: Import['source']; update: (v: Import['source']) => void }) => {
    const store = useStore();
    let [tmp, setTmp] = useState('');
    let body;
    switch (value.type) {
        case 'local':
            body = <div>AUTOCOMPLETE LOCAL MODULES</div>;
            break;
        case 'project':
            const mc = store.moduleChildren();
            body = (
                <div>
                    {mc['root'].map((id) => (
                        <div key={id}>
                            <button
                                disabled={value.type === 'project' && value.module === id}
                                onClick={() =>
                                    update({
                                        type: 'project',
                                        module: id,
                                    })
                                }
                            >
                                {store.module(id).name}
                            </button>
                        </div>
                    ))}
                </div>
            );
            break;
        case 'vendor':
            body = (
                <div>
                    Vendor src:
                    <input value={tmp} onChange={(evt) => setTmp(evt.target.value)} />
                </div>
            );
            break;
    }

    return (
        <div>
            <div>
                {['project', 'local', 'vendor'].map((name) => (
                    <button
                        key={name}
                        disabled={name === value.type}
                        onClick={() => {
                            update(
                                name === 'project'
                                    ? { type: 'project', module: '' }
                                    : name === 'local'
                                      ? { type: 'local', toplevel: '' }
                                      : { type: 'vendor', src: '' },
                            );
                        }}
                    >
                        {name}
                    </button>
                ))}
            </div>
            {body}
        </div>
    );
};
const ImportPlugins = ({ source, value, update }: { source: Import['source']; value: Import['plugins']; update: (v: Import['plugins']) => void }) => {
    return 'plugisn';
};
const ImportMacros = ({ source, value, update }: { source: Import['source']; value: Import['macros']; update: (v: Import['macros']) => void }) => {
    return 'hi';
};
const ImportItems = ({ source, value, update }: { source: Import['source']; value: Import['items']; update: (v: Import['items']) => void }) => {
    const store = useStore();
    let options: Import['items'] | null = null;
    if (source.type === 'project') {
        const mod = store.module(source.module);
        if (mod) {
            options = [];
            const es = store.estore();
            Object.values(es.state[source.module].parseResults).forEach((res) => {
                if (res.kind.type === 'definition') {
                    res.kind.provides.forEach((prov) => {
                        // options!.push({ name: prov.name, kind: prov.kind, loc: '' });
                    });
                }
            });
        } else {
            options = [
                // { name: 'one', kind: 'value', loc: '' },
                // { name: 'two', kind: 'value', loc: '' },
            ];
        }
    }
    if (!options) {
        return <div>Unable to determine available exports</div>;
    }
    return (
        <div>
            {options.map((option, i) => (
                <div key={i}>
                    <label>
                        <input
                            type="checkbox"
                            onChange={(evt) => {
                                if (evt.target.checked) {
                                    update(
                                        value.concat([
                                            {
                                                name: option.name,
                                                kind: option.kind,
                                                loc: '',
                                                accessControl: 'package',
                                            },
                                        ]),
                                    );
                                } else {
                                    update(value.filter((v) => v.name !== option.name || v.kind !== option.kind));
                                }
                            }}
                            checked={value.find((f) => f.name === option.name && f.kind === option.kind) != null}
                        />{' '}
                        {option.name} : {option.kind}
                    </label>
                </div>
            ))}
        </div>
    );
};
const ImportForm = ({ value, update }: { value: Import; update: (v: Import) => void }) => {
    return (
        <div>
            <strong>Source</strong>
            <ImportSource value={value.source} update={(source) => update({ ...value, source })} />
            <label style={{ display: 'block' }}>
                <input type="checkbox" checked={!!value.all} onChange={(evt) => update({ ...value, all: evt.target.checked })} />
                All
            </label>
            {value.all ? null : (
                <>
                    <ImportPlugins source={value.source} value={value.plugins} update={(plugins) => update({ ...value, plugins })} />
                    <ImportMacros source={value.source} value={value.macros} update={(macros) => update({ ...value, macros })} />
                    <ImportItems source={value.source} value={value.items} update={(items) => update({ ...value, items })} />
                </>
            )}
        </div>
    );
};
const NewImport = ({ onSave }: { onSave: (v: Import) => void }) => {
    const [value, setValue] = useState({ source: { type: 'project', module: '' }, macros: [], plugins: [], items: [] } as Import);

    return (
        <div>
            <ImportForm value={value} update={setValue} />
            <button onClick={() => onSave(value)}>Add</button>
        </div>
    );
};

// export const ModuleImports = () => {
//     const store = useStore();
//     const module = useModule();
//     if (!Array.isArray(module.imports)) module.imports = [];

//     return (
//         <div>
//             IMPORT
//             {module.imports.map((im, i) => (
//                 <div key={i}>{JSON.stringify(im)}</div>
//             ))}
//             <NewImport
//                 onSave={(im) => {
//                     store.updateModule({ id: module.id, imports: module.imports.concat([im]) });
//                 }}
//             />
//         </div>
//     );
// };
