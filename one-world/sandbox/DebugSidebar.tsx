import { css } from 'goober';
import React, { useState, useMemo } from 'react';
import { stackForEvt, processStack } from '../../type-inference-debugger/demo/App';
import { ShowScope } from '../../type-inference-debugger/demo/ShowScope';
import { ShowStacks } from '../../type-inference-debugger/demo/ShowText';
import { ShowXML } from '../keyboard/ui/XML';
import { shape } from '../shared/shape';
import { Event, TraceText, Rule } from '../syntaxes/dsl3';
import { toXML } from '../syntaxes/xml';
import { useUpdate } from './useProvideDrag';
import { currentTheme } from './themes';
import { zedlight } from './zedcolors';
import { Resizebar } from './Resizebar';
import { ShowColors } from '../../type-inference-debugger/demo/ShowColors';
import {
    getAllSelectionStatuses,
    useModule,
    useParseResults,
    useSelectedTop,
    useSelection,
    useTopParseResults,
    useTopResults,
    useTopSource,
} from './store/editorHooks';
import { useStore } from './store/store';
import { useModuleStatus } from './ModuleSidebar';

const ParseTrace = ({ trace }: { trace: Event[] }) => {
    const [at, setAt] = useState(0);

    const stack = useMemo(() => {
        const stack: Event[][] = [[]];
        for (let i = 0; i < at; i++) {
            const evt = trace[i];
            switch (evt.type) {
                case 'stack-push':
                    stack.push([evt]);
                    break;
                case 'stack-pop':
                    stack.pop();
                    break;
                default:
                    stack[stack.length - 1].push(evt);
            }
        }
        return stack;
    }, [at, trace]);

    return (
        <div>
            <div>Parse Trace</div>
            <input value={at} type="range" min={0} max={trace.length} onChange={(evt) => setAt(+evt.target.value)} /> {at}
            <div>
                {stack.map((stack, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                        {stack.map((evt, i) => {
                            switch (evt.type) {
                                case 'match':
                                    return (
                                        <span key={i}>
                                            Match <ShowTrace text={evt.message} />
                                        </span>
                                    );
                                case 'stack-push':
                                    return (
                                        <span key={i}>
                                            Stack <ShowTrace text={evt.text} /> loc {evt.loc?.slice(-5)}
                                        </span>
                                    );
                                case 'stack-pop':
                                    return null;
                                case 'mismatch':
                                    return (
                                        <span key={i}>
                                            Mismatch <ShowTrace text={evt.message} /> loc {evt.loc?.slice(-5)}{' '}
                                        </span>
                                    );
                                case 'extra':
                                    return <span key={i}>Extra {evt.loc.slice(-5)} </span>;
                            }
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

const ShowTrace = ({ text }: { text: TraceText }) => {
    if (typeof text === 'string') {
        return <span>{text}</span>;
    }
    if (Array.isArray(text)) {
        return (
            <>
                {text.map((t, i) => (
                    <ShowTrace text={t} key={i} />
                ))}
            </>
        );
    }
    if (text.type === 'node') {
        return <span>Node: {shape(text.node)}</span>;
    }
    return <span style={{ color: 'red' }}>{ruleSummary(text.rule)}</span>;
};

const ruleSummary = (rule: Rule<any>): string => {
    switch (rule.type) {
        case 'ref':
            return `ref(${rule.name})`;
        case 'text':
        case 'declaration':
        case 'reference':
        case 'tx':
        case 'star':
        case 'seq':
        case 'or':
        case 'opt':
        case 'loc':
        case 'group':
        case 'scope':
            return `${rule.type}(...)`;
        case 'meta':
            return `${rule.type}(...,${rule.meta})`;
        case 'table':
        case 'list':
            return `${rule.type}(...,kind=${JSON.stringify(rule.kind)})`;
        case 'any':
        case 'none':
        case 'number':
        case 'kwd':
        case 'id':
            return rule.type;
    }
};

const ShowTypeInference = () => {
    const top = useSelectedTop();
    const results = useTopParseResults(top);

    const events = results?.validation?.events ?? [];

    const [at, setAt] = useState(0);
    const breaks = useMemo(() => stackForEvt(events.length - 1, events), [events]);

    const { scope, smap, stack, highlightVars } = useMemo(() => {
        return processStack(
            events.map((evt) =>
                evt.type === 'scope' ? { ...evt, scope: Object.fromEntries(Object.entries(evt.scope).map(([k, v]) => [k, (v as any).scheme])) } : evt,
            ),
            results?.ctx.meta ?? {},
            at,
            false,
        );
    }, [at, false, events, results?.ctx.meta]);

    if (!results?.validation) return <span>No inference results</span>;
    if (!results?.validation.events?.length) return <span>No inference trace</span>;

    return (
        <div style={{ width: 400, overflow: 'auto' }}>
            <input
                type="range"
                min={0}
                value={at}
                max={breaks}
                onChange={(evt) => {
                    setAt(+evt.target.value);
                }}
            />
            <ShowStacks
                showTips={false}
                subst={smap}
                stack={stack}
                hv={highlightVars}
                onClick={() => {
                    // onClick({ type: 'var', name })
                }}
            />
            <ShowScope highlightVars={highlightVars} scope={scope} smap={smap} />
            <Collapsible title="Type Annotations">{JSON.stringify(results.validation.annotations)}</Collapsible>
        </div>
    );
};

const ShowErrorAnnotations = () => {
    const top = useSelectedTop();
    const results = useTopParseResults(top);

    if (!results.validation) return <span>No validation info</span>;

    const byKey = Object.entries(results.validation.annotations[top])
        .map(([key, annotations]) => {
            return { key, errors: annotations.filter((a) => a.type === 'error') };
        })
        .filter((m) => m.errors.length);
    if (!byKey.length) {
        return <div>No errors</div>;
    }
    return byKey.map(({ key, errors }) => (
        <div key={key}>
            <div>{key}</div>
            <div>
                {errors.map((ann, i) => (
                    <div key={i}>{JSON.stringify(ann)}</div>
                ))}
            </div>
        </div>
    ));
};

const ShowCST = () => {
    const top = useSelectedTop();
    const results = useTopParseResults(top);
    if (!results) return null;
    return (
        <div>
            <div style={{ fontSize: '80%', paddingBlock: 16 }}>Toplevel id: {top}</div>
            <ShowXML root={toXML(results.input)} onClick={() => {}} sel={[]} setHover={() => {}} statuses={{}} />
        </div>
    );
};

const ShowAST = () => {
    const top = useSelectedTop();
    const results = useTopParseResults(top);
    if (!results) return null;
    return (
        <div style={{ overflow: 'auto' }}>
            <ShowXML root={toXML(results.result)} onClick={() => {}} sel={[]} setHover={() => {}} statuses={{}} />
        </div>
    );
};

const ShowModuleLog = () => {
    const mod = useStore().selected();
    const estore = useStore().estore();
    return (
        <div style={{ width: 500, overflow: 'auto' }}>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{estore.modulesLog[mod]?.join('\n\n')}</pre>
        </div>
    );
};

const ShowLog = () => {
    const mod = useStore().selected();
    const top = useSelectedTop();
    const estore = useStore().estore();
    return (
        <div style={{ width: 500, overflow: 'auto' }}>
            <pre>{estore.state[mod].processLog[top]?.join('\n\n')}</pre>
        </div>
    );
};

const ShowSource = () => {
    const top = useSelectedTop();
    const results = useTopSource(top);
    return (
        <div style={{ width: 500, overflow: 'auto' }}>
            <pre>{results ?? 'No source...'}</pre>
        </div>
    );
};

const Collapsible = ({ title, children }: { title: string; children: React.ReactNode }) => {
    const [open, setOpen] = useState(false);
    return (
        <div>
            <div
                onClick={() => setOpen(!open)}
                className={css({
                    cursor: 'pointer',
                    padding: '4px 8px',
                    '&:hover': {
                        background: currentTheme.metaNode.punct.color,
                        color: 'white',
                    },
                })}
                style={
                    open
                        ? {
                              background: zedlight.syntax.attribute.color,
                              color: 'white',
                          }
                        : undefined
                }
            >
                {title}
            </div>
            {open ? children : null}
        </div>
    );
};

export const DebugSidebar = () => {
    const results = useParseResults();
    const top = useSelectedTop();

    return (
        <Resizebar id="debug" side="left">
            <div style={{ overflow: 'auto', padding: '8px', flex: 1, minWidth: '300px', backgroundColor: zedlight['border.selected'] }}>
                <div style={{ textAlign: 'center', marginBottom: 8, fontWeight: 600 }}>Debugging</div>
                <div>{results[top]?.trace?.length ? <ParseTrace trace={results[top].trace} /> : null}</div>
                <Collapsible title="CST">
                    <ShowCST />
                </Collapsible>
                <Collapsible title="AST">
                    <ShowAST />
                </Collapsible>
                <Collapsible title="Type Inference">
                    <ShowTypeInference />
                    <Collapsible title="Error Annotations">
                        <ShowErrorAnnotations />
                    </Collapsible>
                </Collapsible>
                <Collapsible title="Compiled Source">
                    <ShowSource />
                </Collapsible>
                <Collapsible title="Selection">
                    <ShowSelection />
                </Collapsible>
                <Collapsible title="Module Log">
                    <ShowModuleLog />
                </Collapsible>
                <Collapsible title="Process Log">
                    <ShowLog />
                </Collapsible>
                <Collapsible title="Module Status">
                    <ShowModuleStatus />
                </Collapsible>
                <Collapsible title="Evaluation Results">
                    <ShowEvaluationResults />
                </Collapsible>
                <Collapsible title="Theme Colors">
                    <ShowColors />
                </Collapsible>
            </div>
        </Resizebar>
    );
};

const ShowEvaluationResults = () => {
    const top = useSelectedTop();
    const results = useTopResults(top);

    return <div>{JSON.stringify(results)}</div>;
};

const ShowModuleStatus = () => {
    const store = useStore();
    const sel = store.useSelected();
    const status = useModuleStatus(sel);
    return (
        <div>
            {sel}
            {JSON.stringify(status)}
        </div>
    );
};

const ShowSelection = () => {
    const sel = useSelection();
    const tid = useSelectedTop();
    const top = useModule().toplevels[tid];

    const statuses = getAllSelectionStatuses(top, sel);

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'min-content min-content', columnGap: 8, rowGap: 8 }}>
                {Object.entries(statuses).map(([key, value]) => (
                    <React.Fragment key={key}>
                        <div style={{ gridColumn: 1, wordBreak: 'break-all', minWidth: 100 }}>{key}</div>
                        <div style={{ gridColumn: 2 }}>{JSON.stringify(value)}</div>
                    </React.Fragment>
                ))}
            </div>
            <strong>Selection</strong>
            <Showsel />
        </div>
    );
};

export const Showsel = () => {
    const sel = useSelection();

    return (
        <>
            {sel.map((sel, i) => (
                <div key={i}>
                    <div>{sel.start.path.children.map((p) => p.slice(-5)).join('; ')}</div>
                    {JSON.stringify(sel.start.cursor)}
                    <div>{sel.end?.path.children.map((p) => p.slice(-5)).join('; ')}</div>
                    {JSON.stringify(sel.end?.cursor)}
                </div>
            ))}
        </>
    );
};
