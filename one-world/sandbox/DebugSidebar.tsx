import { css } from 'goober';
import React, { useState, useMemo } from 'react';
import { stackForEvt, processStack } from '../../type-inference-debugger/demo/App';
import { ShowScope } from '../../type-inference-debugger/demo/ShowScope';
import { ShowStacks } from '../../type-inference-debugger/demo/ShowText';
import { ShowXML } from '../keyboard/ui/XML';
import { shape } from '../shared/shape';
import { Event, TraceText, Rule } from '../syntaxes/dsl3';
import { toXML } from '../syntaxes/xml';
import { useEditor } from './Editor';
import { currentTheme } from './themes';
import { zedlight } from './zedcolors';

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
            return `${rule.type}(...,${JSON.stringify(rule.kind)})`;
        case 'any':
        case 'none':
        case 'number':
        case 'kwd':
        case 'id':
            return rule.type;
    }
};

const ShowTypeInference = () => {
    const editor = useEditor();
    const top = editor.useSelectedTop();
    const results = editor.useTopParseResults(top);

    const events = results?.validation?.events ?? [];

    const [at, setAt] = useState(0);
    const breaks = useMemo(() => stackForEvt(events.length - 1, events), [events]);

    const { byLoc, scope, smap, stack, highlightVars } = useMemo(() => {
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
                onClick={(name) => {
                    // onClick({ type: 'var', name })
                }}
            />
            <ShowScope highlightVars={highlightVars} scope={scope} smap={smap} />
            <Collapsible title="Type Annotations">{JSON.stringify(results.validation.annotations)}</Collapsible>
        </div>
    );
};

const ShowErrorAnnotations = () => {
    const editor = useEditor();
    const top = editor.useSelectedTop();
    const results = editor.useTopParseResults(top);

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
    const editor = useEditor();
    const top = editor.useSelectedTop();
    const results = editor.useTopParseResults(top);
    if (!results) return null;
    return (
        <div>
            <ShowXML root={toXML(results.input)} onClick={() => {}} sel={[]} setHover={() => {}} statuses={{}} />
        </div>
    );
};

const ShowAST = () => {
    const editor = useEditor();
    const top = editor.useSelectedTop();
    const results = editor.useTopParseResults(top);
    if (!results) return null;
    return (
        <div>
            <ShowXML root={toXML(results.result)} onClick={() => {}} sel={[]} setHover={() => {}} statuses={{}} />
        </div>
    );
};

const ShowSource = () => {
    const editor = useEditor();
    const top = editor.useSelectedTop();
    const results = editor.useTopSource(top);
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
    const editor = useEditor();
    const results = editor.useParseResults();
    const top = editor.useSelectedTop();

    return (
        <div style={{ overflow: 'auto', maxWidth: '40vw', padding: '8px 16px', minWidth: '300px' }}>
            <div>Debug sidebar</div>
            <div style={{ fontSize: '80%' }}>{top}</div>
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
        </div>
    );
};
