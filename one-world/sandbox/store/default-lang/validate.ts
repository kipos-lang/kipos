import { Stmt, Type, Expr, Pat, TopItem } from '../../../syntaxes/algw-s2-types';

// export const validate = (stmt: Stmt) => {
//     //
// };
// Based on https://compiler.jaredforsyth.com/algw-s2

import equal from 'fast-deep-equal';
import { Src } from '../../../syntaxes/dsl3';
import { interleave, interleaveF } from '../../../keyboard/interleave';
import { Meta, Renderable } from '../language';
import { RecNode } from '../../../shared/cnodes';
import { id, list } from '../../../keyboard/test-utils';
import { partition } from './binops';
import { genId } from '../../../keyboard/ui/genId';
// import { Src } from '../../lang/parse-dsl';
// import { interleave } from '../../demo/interleave';
// import { Type, Expr, Stmt, Pat } from './Type';

export const builtinSrc = (): Src => ({ type: 'src', left: 'builtin', id: genId() });

export const builtinEnv = () => {
    const builtinEnv: Tenv = {
        aliases: {},
        types: {},
        constructors: {},
        scope: {},
    };
    const concrete = (body: Type): { scheme: Scheme; source: Source } => ({
        scheme: { vars: [], body, src: builtinSrc() },
        source: { type: 'builtin' },
    });
    const generic = (vars: string[], body: Type): { scheme: Scheme; source: Source } => ({
        scheme: { vars, body, src: builtinSrc() },
        source: { type: 'builtin' },
    });
    const tint: Type = { type: 'con', name: 'int', src: builtinSrc() };
    const tbool: Type = { type: 'con', name: 'bool', src: builtinSrc() };
    const tstring: Type = { type: 'con', name: 'string', src: builtinSrc() };
    const t: Type = { type: 'var', name: 't', src: builtinSrc() };
    const a: Type = { type: 'var', name: 'a', src: builtinSrc() };
    const b: Type = { type: 'var', name: 'b', src: builtinSrc() };
    const tapp = (target: Type, ...args: Type[]): Type => ({ type: 'app', args, target, src: builtinSrc() });
    const tcon = (name: string): Type => ({ type: 'con', name, src: builtinSrc() });
    builtinEnv.scope['Math'] = concrete({ type: 'con', name: 'Math', src: builtinSrc() });
    builtinEnv.scope['Error'] = concrete(tfn(tstring, { type: 'con', name: 'Error', src: builtinSrc() }, builtinSrc()));
    builtinEnv.scope['null'] = concrete({ type: 'con', name: 'null', src: builtinSrc() });
    builtinEnv.scope['true'] = concrete({ type: 'con', name: 'bool', src: builtinSrc() });
    builtinEnv.scope['false'] = concrete({ type: 'con', name: 'bool', src: builtinSrc() });
    builtinEnv.scope['length'] = generic(['t'], tfn(tapp(tcon('Array'), t), tint, builtinSrc()));
    builtinEnv.scope['index'] = generic(['t'], tfns([tapp(tcon('Array'), t), tint], t, builtinSrc()));
    builtinEnv.scope['unshift'] = generic(['t'], tfns([tapp(tcon('Array'), t), t], tcon('void'), builtinSrc()));
    builtinEnv.scope['push'] = generic(['t'], tfns([tapp(tcon('Array'), t), t], tcon('void'), builtinSrc()));
    builtinEnv.scope['concat'] = generic(['t'], tfns([tapp(tcon('Array'), t), tapp(tcon('Array'), t)], tapp(tcon('Array'), t), builtinSrc()));
    // builtinEnv.scope['[]'] = generic(['t'], tapp(tcon('Array'), t));
    // builtinEnv.scope['::'] = generic(['t'], tfns([t, tapp(tcon('Array'), t)], tapp(tcon('Array'), t), builtinSrc()));
    builtinEnv.scope['kipos'] = generic(['t'], t);
    builtinEnv.scope['void'] = generic(['t'], tfn(t, { type: 'con', name: 'void', src: builtinSrc() }, builtinSrc()));
    builtinEnv.scope['+'] = concrete(tfns([tint, tint], tint, builtinSrc()));
    builtinEnv.scope['*'] = concrete(tfns([tint, tint], tint, builtinSrc()));
    builtinEnv.scope['+='] = concrete(tfns([tint, tint], tint, builtinSrc()));
    builtinEnv.scope['=='] = concrete(tfns([tint, tint], tbool, builtinSrc()));
    builtinEnv.scope['!='] = concrete(tfns([tint, tint], tbool, builtinSrc()));
    builtinEnv.scope['-'] = concrete(tfns([tint, tint], tint, builtinSrc()));
    builtinEnv.scope['>'] = concrete(tfns([tint, tint], tbool, builtinSrc()));
    builtinEnv.scope['>='] = concrete(tfns([tint, tint], tbool, builtinSrc()));
    builtinEnv.scope['<'] = concrete(tfns([tint, tint], tbool, builtinSrc()));
    builtinEnv.scope['<='] = concrete(tfns([tint, tint], tbool, builtinSrc()));
    builtinEnv.scope['&&'] = concrete(tfns([tbool, tbool], tbool, builtinSrc()));
    builtinEnv.scope['||'] = concrete(tfns([tbool, tbool], tbool, builtinSrc()));
    builtinEnv.scope['='] = generic(['t'], tfns([t, t], tint, builtinSrc()));
    builtinEnv.scope[','] = generic(['a', 'b'], tfns([a, b], tapp(tcon(','), a, b), builtinSrc()));
    builtinEnv.constructors[','] = { free: ['a', 'b'], args: [a, b], result: tapp(tcon(','), a, b) };
    return builtinEnv;
};

export const typeToNode = (t: Type): Renderable => {
    const meta: Record<string, Meta> = {};
    let id = 0;
    return { node: _typeToNode(t, () => id++ + '', meta), meta };
};

const _typeToNode = (t: Type, nloc: () => string, meta: Record<string, Meta>): RecNode => {
    switch (t.type) {
        case 'var': {
            const loc = nloc();
            meta[loc] = { kind: 'var' };
            return id(t.name, loc);
        }
        case 'unquote':
            return list('smooshed')([id('`', nloc()), _typeToNode(t.contents, nloc, meta)], nloc());
        case 'app':
            return list('smooshed')(
                [
                    _typeToNode(t.target, nloc, meta),
                    list('round')(
                        t.args.map((arg) => _typeToNode(arg, nloc, meta)),
                        nloc(),
                    ),
                ],
                nloc(),
            );
        case 'con': {
            const loc = nloc();
            meta[loc] = { kind: 'constructor' };
            return id(t.name, loc);
        }
        case 'fn': {
            return list('spaced')(
                [
                    list('round')(
                        t.args.map((arg) => _typeToNode(arg, nloc, meta)),
                        nloc(),
                    ),
                    id('=>', nloc()),
                    _typeToNode(t.result, nloc, meta),
                ],
                nloc(),
            );
        }
    }
};

export const typeToString = (t: Type): string => {
    switch (t.type) {
        case 'var':
            return t.name;
        case 'unquote':
            return `unquote(${typeToString(t.contents)})`;
        case 'app':
            if (t.target.type === 'con' && t.target.name === ',') {
                return `(${t.args.map((a) => typeToString(a)).join(', ')})`;
            }
            return `${typeToString(t.target)}(${t.args.map((a) => typeToString(a)).join(', ')})`;
        case 'con':
            return t.name;
        case 'fn':
            return `(${t.args.map(typeToString)}) => ${typeToString(t.result)}`;
    }
};

const typeEqual = (one: Type, two: Type): boolean => {
    if (one.type !== two.type) return false;

    switch (one.type) {
        case 'var':
            if (two.type !== 'var') return false;
            return one.name === two.name;
        case 'app':
            if (two.type !== 'app') return false;
            return (
                typeEqual(one.target, two.target) && one.args.length === two.args.length && one.args.every((arg, i) => typeEqual(arg, two.args[i]))
            );
        case 'con':
            if (two.type !== 'con') return false;
            return one.name === two.name;
        default:
            return false;
    }
};

export type Scheme = { vars: string[]; body: Type; src: Src };

export type Source =
    | { type: 'builtin' }
    | { type: 'local'; src: Src }
    | { type: 'toplevel'; module: string; toplevel: string; src: Src; name: string };

export type Tenv = {
    scope: Record<string, { scheme: Scheme; source: Source }>;
    constructors: Record<string, { free: string[]; args: Type[]; result: Type }>;
    types: Record<string, { free: number; constructors: string[] }>;
    aliases: Record<string, { args: string[]; body: Type }>;
};

export const merge = (...ones: string[][]) => {
    const seen: Record<string, true> = {};
    return ones.flat().filter((t) => (seen[t] ? false : (seen[t] = true)));
    // one.forEach(s => seen[s] = true)
    // return one.concat(two.filter(t => seen[t] ? false : (seen[t] = true)))
};

export const typeFree = (type: Type): string[] => {
    switch (type.type) {
        case 'var':
            return [type.name];
        case 'unquote':
        case 'con':
            return [];
        case 'app':
            return type.args.reduce((result, arg) => merge(result, typeFree(arg)), typeFree(type.target));
        case 'fn':
            return type.args.reduce((result, arg) => merge(result, typeFree(arg)), typeFree(type.result));
    }
};

export const schemeFree = (scheme: Scheme) => typeFree(scheme.body).filter((t) => !scheme.vars.includes(t));

export const tenvFree = (tenv: Tenv) => merge(...Object.values(tenv.scope).map((m) => schemeFree(m.scheme)));

export type Subst = Record<string, Type>;

export const gtypeApply = (type: Type): Type => {
    return typeApply(globalState.subst, type);
};
export const typeApply = (subst: Subst, type: Type): Type => {
    switch (type.type) {
        case 'var':
            if (subst[type.name]) {
                return { ...subst[type.name], src: type.src };
            }
            return subst[type.name] ?? type;
        case 'app':
            return { ...type, target: typeApply(subst, type.target), args: type.args.map((arg) => typeApply(subst, arg)) };
        case 'fn':
            return { ...type, result: typeApply(subst, type.result), args: type.args.map((arg) => typeApply(subst, arg)) };
        default:
            return type;
    }
};

export const mapWithout = <T>(map: Record<string, T>, names: string[]): Record<string, T> => {
    const res: Record<string, T> = {};
    Object.keys(map).forEach((k) => {
        if (!names.includes(k)) {
            res[k] = map[k];
        }
    });
    return res;
};

export const schemeApply = (subst: Subst, scheme: Scheme): Scheme => {
    return { ...scheme, body: typeApply(mapWithout(subst, scheme.vars), scheme.body) };
};

export const tenvApply = (subst: Subst, tenv: Tenv): Tenv => {
    return { ...tenv, scope: tscopeApply(subst, tenv.scope) };
};

export const scopeApply = (subst: Subst, scope: Record<string, Scheme>) => {
    const res: Record<string, Scheme> = {};
    Object.keys(scope).forEach((k) => {
        res[k] = schemeApply(subst, scope[k]);
    });
    return res;
};

export const tscopeApply = (subst: Subst, scope: Tenv['scope']) => {
    const res: Tenv['scope'] = {};
    Object.keys(scope).forEach((k) => {
        res[k] = { scheme: schemeApply(subst, scope[k].scheme), source: scope[k].source };
    });
    return res;
};

export const mapMap = <T>(f: (arg: T) => T, map: Record<string, T>): Record<string, T> => {
    const res: Record<string, T> = {};
    Object.keys(map).forEach((k) => {
        res[k] = f(map[k]);
    });
    return res;
};

export const composeSubst = (newSubst: Subst, oldSubst: Subst) => {
    Object.keys(newSubst).forEach((k) => {
        if (oldSubst[k]) {
            console.log(newSubst, oldSubst);
            throw new Error(`overwriting substitution, should not happen`);
        }
    });
    return {
        ...mapMap((t) => typeApply(newSubst, t), oldSubst),
        ...newSubst,
    };
};

export const generalize = (tenv: Tenv, t: Type, src: Src): Scheme => {
    const free = tenvFree(tenv);
    return {
        vars: typeFree(t).filter((n) => !free.includes(n)),
        body: t,
        src,
    };
};

const hole = (active?: boolean): StackText => ({ type: 'hole', active });
const kwd = (kwd: string): StackText => ({ type: 'kwd', kwd });
// allowing number so that `.map(typ)` still works 🙃
const typ = (typ: Type, noSubst: boolean | number = false): StackText => ({ type: 'type', typ, noSubst: noSubst === true });
export type StackText = { type: 'hole'; active?: boolean } | { type: 'kwd'; kwd: string } | ErrorText;

export type StackValue = StackText[];

export type ErrorText = { type: 'type'; typ: Type; noSubst?: boolean } | string;

const stackError = (sources: Src[], ...message: ErrorText[]) => {
    globalState.events.push({ type: 'error', message, sources });
    globalState.events.push({ type: 'stack-push', value: message, src: sources[0] });
    globalState.events.push({ type: 'stack-break', title: 'error' });
};

const stackWarning = (sources: Src[], ...message: ErrorText[]) => {
    globalState.events.push({ type: 'warning', message, sources });
    globalState.events.push({ type: 'stack-push', value: message, src: sources[0] });
    globalState.events.push({ type: 'stack-break', title: 'warning' });
};

const stackPush = (src: Src, ...value: StackText[]) => globalState.events.push({ src, type: 'stack-push', value });
const stackReplace = (src: Src, ...value: StackText[]) => {
    globalState.events.push({ type: 'stack-pop' });
    globalState.events.push({ src, type: 'stack-push', value });
};
const stackPop = () => globalState.events.push({ type: 'stack-pop' });
const stackBreak = (title: string) => globalState.events.push({ type: 'stack-break', title });

export type Event =
    | { type: 'unify'; tmp?: boolean; one: Type; two: Type; subst: Subst; src: Src; oneName: string; twoName: string; message?: string }
    | { type: 'scope'; scope: Tenv['scope'] }
    | { type: 'infer'; src: Src; value: Type }
    | { type: 'new-var'; name: string }
    | { type: 'error' | 'warning'; message: ErrorText[]; sources: Src[] }
    | { type: 'stack-break'; title: string }
    | { type: 'stack-push'; value: StackValue; src: Src }
    | { type: 'stack-pop' };

export type State = {
    nextId: number;
    subst: Subst;
    events: Event[];
    tvarMeta: Record<string, TvarMeta>;
    latestScope?: Tenv['scope'];
    resolutions: Record<string, Source>;
};

type TvarMeta =
    | { type: 'array-item'; src: Src }
    | { type: 'free'; prev: string }
    | { type: 'return-any'; src: Src }
    | {
          type: 'pat-var';
          name: string;
          src: Src;
      }
    | { type: 'lambda-return'; src: Src }
    | { type: 'apply-result'; src: Src }
    | { type: 'unsafe' | 'throw'; src: Src }
    | { type: 'pat-any'; src: Src };

let globalState: State = { nextId: 0, subst: {}, events: [], tvarMeta: {}, resolutions: {} };
export const resetState = () => {
    globalState = { nextId: 0, subst: {}, events: [], tvarMeta: {}, resolutions: {} };
};
export const getGlobalState = () => globalState;

const alphabet = 'abcdefghijklmnopqrstuvwxyz';
const makeName = (n: number) => {
    let res = '';
    while (n >= alphabet.length) {
        res = alphabet[n % alphabet.length] + res;
        n = Math.floor(n / alphabet.length);
    }
    res = alphabet[n] + res;
    return res;
};

export const newTypeVar = (meta: TvarMeta, src: Src): Extract<Type, { type: 'var' }> => {
    const name = makeName(globalState.nextId++);
    globalState.events.push({ type: 'new-var', name });
    globalState.tvarMeta[name] = meta;
    return { type: 'var', name, src };
};

export const makeSubstForFree = (vars: string[], src: Src) => {
    const mapping: Subst = {};
    vars.forEach((id) => {
        mapping[id] = newTypeVar({ type: 'free', prev: id }, src);
    });
    return mapping;
};

export const instantiate = (scheme: Scheme, src: Src) => {
    const subst = makeSubstForFree(scheme.vars, src);
    return { ...typeApply(subst, scheme.body), src };
};

export const varBind = (name: string, type: Type) => {
    if (type.type === 'var') {
        if (type.name === name) {
            return {};
        }
        return { [name]: type };
    }
    if (typeFree(type).includes(name)) {
        throw new Error(`Cycle found while unifying type with type variable: ${name}`);
    }
    return { [name]: type };
};

export const unify = (one: Type, two: Type, src: Src, oneName: string, twoName: string, message?: string) => {
    one = typeApply(globalState.subst, one);
    two = typeApply(globalState.subst, two);
    const subst = unifyInner(one, two);
    globalState.events.push({ type: 'unify', one, two, subst, src, oneName, twoName, message });
    globalState.subst = composeSubst(subst, globalState.subst);
};

export const unifyInner = (one: Type, two: Type): Subst => {
    let recurse = unifyInner;
    // let recurse = (one: Type, two: Type): Subst => {
    //     const subst = unifyInner(one, two);
    //     globalState.events.push({ type: 'unify', tmp: true, one, two, subst, src: one.src, oneName: 'one', twoName: 'two' });
    //     return subst;
    // };
    if (one.type === 'var') {
        return varBind(one.name, two);
    }
    if (two.type === 'var') {
        return varBind(two.name, one);
    }
    if (one.type === 'con' && two.type === 'con') {
        if (one.name === two.name) return {};
        stackError([one.src, two.src], `Incompatible concrete types: `, { type: 'type', typ: one }, ` vs `, { type: 'type', typ: two });
        // throw new Error(`Incompatible concrete types: ${one.name} vs ${two.name}`);
        return {};
    }
    if (one.type === 'fn' && two.type === 'fn') {
        if (one.args.length !== two.args.length) {
            stackError([one.src, two.src], `number of args in function is different: `, { type: 'type', typ: one }, ` vs `, {
                type: 'type',
                typ: two,
            });
        }
        let subst = recurse(one.result, two.result);
        for (let i = 0; i < one.args.length && i < two.args.length; i++) {
            subst = composeSubst(recurse(typeApply(subst, one.args[i]), typeApply(subst, two.args[i])), subst);
        }
        return subst;
    }
    if (one.type === 'app' && two.type === 'app') {
        if (one.args.length !== two.args.length) {
            stackError([one.src, two.src], `number of args in generic is different: `, { type: 'type', typ: one }, ` vs `, {
                type: 'type',
                typ: two,
            });
        }
        let subst = recurse(one.target, two.target);
        for (let i = 0; i < one.args.length && i < two.args.length; i++) {
            subst = composeSubst(recurse(typeApply(subst, one.args[i]), typeApply(subst, two.args[i])), subst);
        }
        return subst;
    }
    stackError([one.src, two.src], `Incompatible types: `, { type: 'type', typ: one }, ` vs `, { type: 'type', typ: two });
    return {};
};

export const inferExpr = (tenv: Tenv, expr: Expr) => {
    if (!globalState.latestScope || !equal(tscopeApply(globalState.subst, globalState.latestScope), tscopeApply(globalState.subst, tenv.scope))) {
        globalState.latestScope = tenv.scope;
        globalState.events.push({ type: 'scope', scope: tenv.scope });
    }
    // console.log('infer expr', expr);
    // const old = globalState.subst;
    // globalState.subst = {};
    const type = inferExprInner(tenv, expr);
    globalState.events.push({ type: 'infer', src: expr.src, value: type });
    // globalState.subst = composeSubst(globalState.subst, old);
    return type;
};

export const tfn = (arg: Type, body: Type, src: Src & { id: string }): Type => ({ type: 'fn', args: [arg], result: body, src });
// ({ type: 'app', target: { type: 'app', target: { type: 'con', name: '->' }, arg }, arg: body });
export const tfns = (args: Type[], body: Type, src: Src & { id: string }): Type => ({ type: 'fn', args, result: body, src });
// args.reduceRight((res, arg) => tfn(arg, res), body);

const tenvWithScope = (tenv: Tenv, locals: Record<string, Scheme>): Tenv => {
    const scope = { ...tenv.scope };
    Object.entries(locals).forEach(([key, scheme]) => (scope[key] = { scheme, source: { type: 'local', src: scheme.src } }));
    return { ...tenv, scope };
};

export const inferLets = (
    tenv: Tenv,
    lets: (Stmt & { type: 'let'; pat: { type: 'var' }; init: { type: 'lambda' } })[],
): { scopes: Record<string, Scheme>[]; values: Type[]; events: [number, number][] } => {
    const recscope: Record<string, Scheme> = {};
    const names = lets.map(({ pat, src }) => {
        const pv = newTypeVar({ type: 'pat-var', name: pat.name, src: pat.src }, pat.src);
        stackPush(pat.src, pat.name, ' -> ', typ(pv));
        stackBreak(`create a type variable for the name '${pat.name}'`);
        stackPop();
        globalState.events.push({ type: 'infer', src: pat.src, value: pv });
        recscope[pat.name] = { body: pv, vars: [], src };
        return pv;
    });
    const self = tenvWithScope(tenv, recscope);

    const scopes: Record<string, Scheme>[] = [];

    const events: [number, number][] = [];
    const values = lets.map((stmt, i) => {
        const start = globalState.events.length;
        const { pat, init, src } = stmt;
        stackPush(src, kwd('let'), ' ', hole(), ' = ', hole());
        stackBreak("'let' statement");

        stackReplace(src, kwd('let'), ' ', hole(true), ' = ', hole());
        stackReplace(src, kwd('let'), ' ', typ(names[i]), ' = ', hole());
        // globalState.events.push({ type: 'infer', src: pat.src, value: pv });
        stackBreak("'let' statement");
        stackReplace(src, kwd('let'), ' ', typ(names[i]), ' = ', hole(true));
        // globalState.events.push({ type: 'stack-push', value: { type: 'let', pat: pv } });
        // const self = tenvWithScope(tenv, { [pat.name]: { body: pv, vars: [], src } });
        const valueType = inferExpr(self, init);
        // stackReplace(src, typ(pv), ' -> ', typ(valueType));
        // stackBreak();
        unify(typeApply(globalState.subst, names[i]), valueType, stmt.src, `variable for '${pat.name}'`, `inferred type of value`);
        stackPop();
        const end = globalState.events.length;
        events.push([start, end]);
        // globalState.events.push({ type: 'stack-pop' });
        // globalState.events.push({ type: 'infer', src: pat.src, value: valueType });
        return valueType;
    });

    const appliedEnv = tenvApply(globalState.subst, tenv);
    // const allFree =
    values.forEach((value, i) => {
        scopes.push({ [lets[i].pat.name]: generalize(appliedEnv, gtypeApply(value), lets[i].pat.src) });
    });
    // console.log('here we are', scopes);

    return { scopes, values: values.map(gtypeApply), events };
};
export const inferToplevel = (tenv: Tenv, stmt: TopItem): { value: Type; scope?: Record<string, Scheme> } => {
    switch (stmt.type) {
        case 'type':
            return { value: { type: 'con', name: 'void', src: stmt.src } };
        case 'test': {
            const { name, target, src, cases } = stmt;
            const ttype = target ? inferExpr(tenv, target) : null;
            cases.forEach(({ input, output, outloc }) => {
                const itype = inferExpr(tenv, input);
                const otype = inferExpr(tenv, output);
                if (ttype) {
                    unify(ttype, tfn(itype, otype, input.src), input.src, 'target', 'input -> output');
                } else {
                    unify(itype, otype, input.src, 'input', 'output');
                }
            });
            return { value: { type: 'con', name: 'void', src } }; // basic case, types equal
        }
        case 'stmt':
            return inferStmt(tenv, stmt.stmt);
    }
};

export const inferStmt = (tenv: Tenv, stmt: Stmt): { value: Type; scope?: Record<string, Scheme> } => {
    switch (stmt.type) {
        case 'return': {
            const value = newTypeVar({ type: 'return-any', src: stmt.src }, stmt.src);
            if (!tenv.scope['return']) {
                throw new Error(`cant return, we are not in a lambda`);
            }
            if (!stmt.value) {
                stackPush(stmt.src, `return`);
                stackBreak('return statement');
                unify(tenv.scope['return'].scheme.body, { type: 'con', name: 'void', src: stmt.src }, stmt.src, 'early return type', 'empty return');
                stackPop();
                return { value };
            }
            stackPush(stmt.src, `return `, hole(true));
            stackBreak('return statement');
            const inner = inferExpr(tenv, stmt.value);
            unify(tenv.scope['return'].scheme.body, inner, stmt.src, 'early return type', 'return value');
            stackPop();
            return { value };
        }
        case 'let': {
            const { pat, init, src } = stmt;
            stackPush(src, kwd('let'), ' ', hole(), ' = ', hole());
            stackBreak("'let' statement");
            if (pat.type === 'var') {
                stackReplace(src, kwd('let'), ' ', hole(true), ' = ', hole());
                const pv = newTypeVar({ type: 'pat-var', name: pat.name, src: pat.src }, pat.src);
                stackPush(pat.src, pat.name, ' -> ', typ(pv));
                stackBreak(`create a type variable for the name '${pat.name}'`);
                stackPop();
                stackReplace(src, kwd('let'), ' ', typ(pv), ' = ', hole());
                globalState.events.push({ type: 'infer', src: pat.src, value: pv });
                stackBreak("'let' statement");
                stackReplace(src, kwd('let'), ' ', typ(pv), ' = ', hole(true));
                // globalState.events.push({ type: 'stack-push', value: { type: 'let', pat: pv } });
                const self = tenvWithScope(tenv, { [pat.name]: { body: pv, vars: [], src } });
                const valueType = inferExpr(self, init);
                // stackReplace(src, typ(pv), ' -> ', typ(valueType));
                // stackBreak();
                unify(typeApply(globalState.subst, pv), valueType, stmt.src, `variable for '${pat.name}'`, `inferred type of value`);
                const appliedEnv = tenvApply(globalState.subst, tenv);
                stackPop();
                // globalState.events.push({ type: 'stack-pop' });
                // globalState.events.push({ type: 'infer', src: pat.src, value: valueType });
                return {
                    scope: {
                        [pat.name]: init.type === 'lambda' ? generalize(appliedEnv, valueType, pat.src) : { vars: [], body: valueType, src: pat.src },
                    },
                    value: gtypeApply(valueType),
                };
            }
            let [type, scope] = inferPattern(tenv, pat);
            // globalState.events.push({ type: 'stack-push', value: { type: 'let', pat: type } });
            const valueType = inferExpr(tenvWithScope(tenv, scope), init);
            unify(typeApply(globalState.subst, type), valueType, stmt.src, `pattern type`, `inferred type of value`);
            scope = scopeApply(globalState.subst, scope);
            // globalState.events.push({ type: 'stack-pop' });
            stackPop();
            return { scope: scope, value: { type: 'con', name: 'void', src } };
        }
        case 'expr':
            const value = inferExpr(tenv, stmt.expr);
            return { value: value };
        case 'for': {
            // console.error('not stacking yet');
            const letter = inferStmt(tenv, stmt.init);
            const bound = letter.scope ? tenvWithScope(tenvApply(globalState.subst, tenv), letter.scope) : tenv;
            const upter = inferExpr(bound, stmt.cond);
            unify(upter, { type: 'con', name: 'bool', src: stmt.src }, stmt.src, 'for loop condition', 'must be bool');
            const okk = inferExpr(bound, stmt.update);
            const body = inferExpr(bound, stmt.body);

            return { value: { type: 'con', name: 'void', src: stmt.src } };
        }
        // case 'match':
        //     throw new Error('not right now');
        // case 'match': {
        //     let targetType = inferExpr(tenv, stmt.target);
        //     let resultType: Type = newTypeVar('match result');
        //     let midTarget = targetType;

        //     let returnt: Type|null = null;

        //     for (let kase of stmt.cases) {
        //         let [type, scope] = inferPattern(tenv, kase.pat);
        //         unify(type, midTarget);
        //         scope = scopeApply(globalState.subst, scope);
        //         const innerTenv = { ...tenv, scope: { ...tenv.scope, ...scope } }
        //         if (kase.body.type === 'block') {
        //             const result = inferStmt(innerTenv, kase.body);
        //             if (result.return && !result.all) {
        //                 throw new Error(`block doesnt return consistently. add a return at the end?`)
        //             }
        //             argType = typeApply(globalState.subst, argType);
        //             return tfn(argType, result.return ?? {type: 'con', name: 'void'});
        //         }
        //         const bodyType = inferExpr(innerTenv, kase.body);
        //         unify(typeApply(globalState.subst, resultType), bodyType);
        //         midTarget = typeApply(globalState.subst, midTarget);
        //         resultType = typeApply(globalState.subst, resultType);
        //     }
        //     // TODO: check exhaustiveness
        //     // checkExhaustiveness(tenv, typeApply(globalState.subst, targetType), stmt.cases.map(k => k.pat))
        //     return resultType;
        // }
        default:
            throw new Error(`nope ${(stmt as any).type}`);
    }
};

const commas = (v: StackText[], sep = ', ') => interleaveF(v, () => sep);

export const inferExprInner = (tenv: Tenv, expr: Expr): Type => {
    switch (expr.type) {
        case 'object': {
            const t = newTypeVar({ type: 'free', prev: 'object' }, expr.src);
            return t;
        }
        case 'prim':
            const t: Type = { type: 'con', name: expr.prim.type, src: expr.src };
            stackPush(expr.src, kwd(expr.prim.value + ''), ' -> ', typ(t));
            stackBreak(`primitive constant`);
            stackPop();
            return t;
        case 'array': {
            let t = newTypeVar({ type: 'array-item', src: expr.src }, expr.src);
            let arrayType: Type = { type: 'app', args: [t], src: expr.src, target: { type: 'con', name: 'Array', src: expr.src } };
            stackPush(expr.src, '[', ...commas(expr.items.map(() => hole())), '] -> ', typ(arrayType));
            stackBreak(`array literal with ${expr.items.length} ${n(expr.items.length, 'item', 'items')}`);
            for (let item of expr.items) {
                stackReplace(expr.src, '[', ...commas(expr.items.map((it) => hole(it === item))), '] -> ', typ(arrayType));
                if (item.type === 'spread') {
                    const v = inferExpr(tenv, item.inner);
                    unify(gtypeApply(arrayType), v, item.src, 'array type', 'inferred spread');
                } else {
                    const v = inferExpr(tenv, item);
                    unify(gtypeApply(t), v, item.src, 'array item type', 'inferred item');
                }
            }
            stackPop();
            return gtypeApply(arrayType);
        }
        case 'var':
            if (!expr.name.trim()) {
                stackError([expr.src], 'expected identifier, found a blank');
                return newTypeVar({ type: 'free', prev: expr.name }, expr.src);
            }
            const got = tenv.scope[expr.name];
            if (!got) {
                stackError([expr.src], `variable not found in scope: ${expr.name}`);
                return newTypeVar({ type: 'free', prev: expr.name }, expr.src);
                // throw new Error();
            }
            globalState.resolutions[expr.src.id] = got.source;
            if (got.scheme.vars.length) {
                stackPush(
                    expr.src,
                    kwd(expr.name),
                    ' -> ',
                    '<',
                    ...got.scheme.vars.map((name) => typ({ type: 'var', name, src: expr.src }, true)),
                    '>',
                    typ(got.scheme.body, true),
                );
            } else {
                stackPush(expr.src, kwd(expr.name), ' -> ', typ(got.scheme.body));
            }
            stackBreak('variable lookup');
            const inst = instantiate(got.scheme, expr.src);
            if (got.scheme.vars.length) {
                stackReplace(expr.src, kwd(expr.name), ' -> ', typ(inst));
                stackBreak('create new variables for the type parameters');
            }
            stackPop();
            return inst;
        case 'str':
            stackPush(expr.src, kwd(JSON.stringify(expr.value)), ' -> ', typ({ type: 'con', name: 'string', src: expr.src }));
            stackBreak(`primitive constant`);
            stackPop();
            return { type: 'con', name: 'string', src: expr.src };
        case 'lambda': {
            if (!expr.args.length) {
                throw new Error(`cant have an empty lambda sry`);
            }
            const src = expr.src;
            stackPush(src, '(', ...commas(expr.args.map(() => hole())), '): ', hole(), ' => ', hole());
            stackBreak('arrow function');
            let scope: Tenv['scope'] = {};
            let args: Type[] = [];
            expr.args.forEach((pat, i) => {
                stackReplace(src, '(', ...commas(expr.args.map((_, j) => hole(j === i))), '): ', hole(), ' => ', hole());
                stackBreak('arrow function argument #' + (i + 1));
                let [argType, patScope] = inferPattern(tenv, pat);
                patScope = scopeApply(globalState.subst, patScope);
                args.push(argType);
                Object.entries(patScope).forEach(([key, scheme]) => {
                    scope[key] = { scheme, source: { type: 'local', src: scheme.src } };
                });
                globalState.events.push({ type: 'infer', src: pat.src, value: argType });
            });
            stackReplace(src, '(', ...commas(args.map(typ)), '): ', hole(true), ' => ', hole());
            const returnVar = newTypeVar({ type: 'lambda-return', src: expr.src }, expr.src);
            scope.return = { scheme: { vars: [], body: returnVar, src }, source: { type: 'local', src } };

            stackPush(src, typ(returnVar));
            stackBreak(`Create a type variable for tracking early returns`);
            globalState.events.push({ type: 'infer', src: { type: 'src', left: expr.src.left, id: genId() }, value: returnVar });
            stackPop();
            let boundEnv = { ...tenv, scope: { ...tenv.scope, ...scope } };
            stackReplace(src, '(', ...commas(args.map(typ)), '): ', typ(returnVar), ' => ', hole());
            stackBreak('arrow function');
            stackReplace(src, '(', ...commas(args.map(typ)), '): ', typ(returnVar), ' => ', hole(true));

            const bodyType = inferExpr(boundEnv, expr.body);

            // This is unifying the inferred type of the lambda body
            // (which should be hoverable) with any `return` forms
            // we encountered.
            // IF `returnVar` has no substs, or IF bodyType is a
            // substless vbl, we can do this ~quietly.
            stackReplace(src, '(', ...commas(args.map(typ)), '): ', typ(returnVar), ' => ', typ(bodyType));
            stackBreak(`Unifying body type with early return type`);
            unify(bodyType, typeApply(globalState.subst, returnVar), expr.src, `inferred body type`, `early return type`);

            stackReplace(src, '(', ...commas(args.map(typ)), '): ', typ(returnVar), ' => ', typ(typeApply(globalState.subst, returnVar)));
            stackBreak('arrow function');
            stackPop();
            return tfns(
                args.map((arg) => typeApply(globalState.subst, arg)),
                typeApply(globalState.subst, returnVar),
                expr.src,
                // bodyType.value ?? bodyType.return ?? { type: 'con', name: 'void' },
            );
        }
        case 'uop': {
            const inner = inferExpr(tenv, expr.target);
            unify(
                inner,
                { type: 'con', name: expr.op.text === '!' ? 'bool' : 'int', src: { type: 'src', id: genId(), left: expr.op.loc } },
                expr.src,
                'unary argument',
                'unary operator',
            );
            return gtypeApply(inner);
        }
        case 'bop': {
            // const src = expr.src;

            const bop = partition(expr.left, expr.rights);
            return inferExprInner(tenv, bop);

            // stackPush(src, hole(), hole(), hole());
            // stackBreak(`function call with ${expr.args.args.length} ${n(expr.args.args.length, 'argument', 'arguments')}`);
            // stackReplace(src, ...pre, hole(true), '(', ...commas(expr.args.args.map(() => hole())), ') -> ', typ(resultVar));

            // return
        }

        // hmm.
        case 'constructor': {
            switch (expr.args?.type) {
                case 'unnamed':
                    expr.args.args.map((arg) => {
                        inferExpr(tenv, arg.type === 'spread' ? arg.inner : arg);
                    });
                    break;
                case 'named':
                    expr.args.args.forEach((row) => {
                        if (row.type === 'row') {
                            if (row.value) {
                                inferExpr(tenv, row.value);
                            } else {
                                inferExpr(tenv, { type: 'var', name: row.name.text, src: { type: 'src', left: row.name.loc, id: genId() } });
                            }
                        } else {
                            inferExpr(tenv, row.inner);
                        }
                    });
                    break;
            }
            // throw new Error(`constructors not yet checked`);
            return newTypeVar({ type: 'free', prev: 'lol' }, expr.src);
        }

        case 'throw': {
            // stackWarning([expr.src], `indexes are entirely unchecked`);
            inferExpr(tenv, expr.value);
            return newTypeVar({ type: 'throw', src: expr.src }, expr.src);
        }
        case 'new': {
            stackWarning([expr.src], `"new" are entirely unchecked`);
            inferExpr(tenv, expr.value);
            return newTypeVar({ type: 'throw', src: expr.src }, expr.src);
        }

        case 'index': {
            stackWarning([expr.src], `indexes are entirely unchecked`);
            inferExpr(tenv, expr.target);
            expr.index.forEach((item) => inferExpr(tenv, item));
            return newTypeVar({ type: 'unsafe', src: expr.src }, expr.src);
        }

        case 'attribute': {
            stackWarning([expr.src], `attributes are entirely unchecked`);
            inferExpr(tenv, expr.target);
            return newTypeVar({ type: 'unsafe', src: expr.src }, expr.src);
        }

        case 'tuple': {
            if (expr.items.length === 1 && expr.items[0].type !== 'spread') {
                return inferExpr(tenv, expr.items[0]);
            }
            const types: Type[] = [];
            expr.items.forEach((item) => {
                if (item.type === 'spread') {
                    stackError([item.src], `spread in tuples not supported yet`);
                    return;
                }
                types.push(inferExpr(tenv, item));
            });
            return { type: 'app', target: { type: 'con', name: `,${types.length}`, src: expr.src }, args: types, src: expr.src };
        }

        case 'app': {
            const resultVar = newTypeVar({ type: 'apply-result', src: expr.src }, expr.src);
            globalState.events.push({ type: 'infer', src: expr.src, value: resultVar });

            if (expr.args.type === 'named') throw new Error(`expr.argssss`);

            const src = expr.src;
            const pre = expr.target.type === 'var' ? ['call to ', kwd(expr.target.name), ' '] : [];
            stackPush(src, ...pre, hole(), '(', ...commas(expr.args.args.map(() => hole())), ') -> ', typ(resultVar));
            stackBreak(`function call with ${expr.args.args.length} ${n(expr.args.args.length, 'argument', 'arguments')}`);
            stackReplace(src, ...pre, hole(true), '(', ...commas(expr.args.args.map(() => hole())), ') -> ', typ(resultVar));

            let targetType = inferExpr(tenv, expr.target);

            stackReplace(
                src,
                ...pre,
                typ(typeApply(globalState.subst, targetType)),
                '(',
                ...commas(expr.args.args.map(() => hole())),
                ') -> ',
                typ(resultVar),
            );
            stackBreak(`function call with ${expr.args.args.length} ${n(expr.args.args.length, 'argument', 'arguments')}`);

            const argTenv = tenvApply(globalState.subst, tenv);

            const holes: StackText[] = [];
            for (let i = 0; i < expr.args.args.length; i++) {
                holes.push(hole());
            }

            let args: Type[] = [];

            for (let i = 0; i < expr.args.args.length; i++) {
                const mid = commas(args.map(typ).concat([hole(true), ...holes.slice(i + 1)]));
                stackReplace(src, ...pre, typ(typeApply(globalState.subst, targetType)), '(', ...mid, ') -> ', typ(resultVar));
                stackBreak('argument #' + (i + 1));
                const arg = expr.args.args[i];
                if (arg.type === 'spread') {
                    throw new Error('spreaddd');
                }
                const got = inferExpr(argTenv, arg);
                args.push(got);
            }

            stackReplace(src, ...pre, typ(typeApply(globalState.subst, targetType)), '(', ...commas(args.map(typ)), ') -> ', typ(resultVar));
            stackBreak('Ready to unify');

            // console.log(expr.target, targetType.value);
            // console.log('args', expr.args);
            unify(
                typeApply(globalState.subst, targetType),
                tfns(args, resultVar, expr.src),
                expr.src,
                `function being called`,
                `arguments and result variable`,
            );
            stackPop();
            return typeApply(globalState.subst, resultVar);
        }

        case 'if': {
            const src = expr.src;
            // TODO: handle else
            stackPush(src, kwd('if'), ' (', hole(), ') {', hole(), '}', ...(expr.no ? [' else {', hole(), ')'] : []));
            stackBreak('if conditional');
            stackReplace(src, kwd('if'), ' (', hole(true), ') {', hole(), '}', ...(expr.no ? [' else {', hole(), ')'] : []));
            const cond = inferExpr(tenv, expr.cond);
            unify(cond, { type: 'con', name: 'bool', src: expr.src }, expr.cond.src, 'if condition', 'must be bool');
            stackReplace(
                src,
                kwd('if'),
                ' (',
                typ(typeApply(globalState.subst, cond)),
                ') {',
                hole(),
                '}',
                ...(expr.no ? [' else {', hole(), ')'] : []),
            );
            stackBreak('if conditional');

            stackReplace(
                src,
                kwd('if'),
                ' (',
                typ(typeApply(globalState.subst, cond)),
                ') {',
                hole(true),
                '}',
                ...(expr.no ? [' else {', hole(), ')'] : []),
            );
            const one = inferExpr(tenv, expr.yes);
            stackReplace(
                src,
                kwd('if'),
                ' (',
                typ(typeApply(globalState.subst, cond)),
                ') {',
                typ(gtypeApply(one)),
                '}',
                ...(expr.no ? [' else {', hole(), ')'] : []),
            );
            stackBreak('if yes');

            const two = expr.no ? inferExpr(tenv, expr.no) : undefined;
            const twov = two ? two : { type: 'con' as const, name: 'void', src: expr.src };
            unify(one, twov, expr.src, 'yes branch', 'else branch');

            stackPop();
            return one;
        }
        case 'block': {
            if (!expr.stmts.length) {
                return { type: 'con', name: 'void', src: expr.src };
            }
            stackPush(
                expr.src,
                `{`,
                ...commas(
                    expr.stmts.map((s) => hole()),
                    '; ',
                ),
                '} -> ',
                hole(),
            );
            stackBreak(`block with ${expr.stmts.length} ${n(expr.stmts.length, 'statement', 'statements')}`);
            let scope = {};
            let value: Type | null = null;
            let i = -1;
            for (let inner of expr.stmts) {
                i++;
                stackReplace(
                    expr.src,
                    `{`,
                    ...commas(
                        expr.stmts.map((s, n) => hole(n === i)),
                        '; ',
                    ),
                    '} -> ',
                    hole(),
                );
                const applied = tenvApply(globalState.subst, tenv);
                const res = inferStmt(tenvWithScope(applied, scope), inner);
                if (res.scope) {
                    Object.assign(scope, res.scope);
                }
                value = res.value;
            }
            if (!value) throw new Error('how did we get here');
            stackReplace(
                expr.src,
                `{`,
                ...commas(
                    expr.stmts.map((s) => hole()),
                    '; ',
                ),
                '} -> ',
                typ(value!),
            );
            stackBreak(`block result type`);
            stackPop();
            return typeApply(globalState.subst, value);
        }
        // case 'Array': {
        //     // expr.items
        // }

        // case 'let': {
        //     if (expr.vbls.length === 0) throw new Error('no bindings in let');
        //     if (expr.vbls.length > 1) {
        //         const [one, ...more] = expr.vbls;
        //         return inferExpr(tenv, {
        //             type: 'let',
        //             vbls: [one],
        //             body: { type: 'let', vbls: more, body: expr.body, src: expr.src },
        //             src: expr.src,
        //         });
        //     }
        //     const { pat, init } = expr.vbls[0];
        //     if (pat.type === 'var') {
        //         const valueType = inferExpr(tenv, init);
        //         const appliedEnv = tenvApply(globalState.subst, tenv);
        //         const boundEnv = { ...tenv, scope: { ...tenv.scope, [pat.name]: generalize(appliedEnv, valueType) } };
        //         if (expr.body.type === 'var' && expr.body.name === 'null') {
        //             return typeApply(globalState.subst, valueType);
        //         }
        //         return inferExpr(boundEnv, expr.body);
        //     }
        //     let [type, scope] = inferPattern(tenv, pat);
        //     const valueType = inferExpr(tenv, init);
        //     unify(type, valueType);
        //     scope = scopeApply(globalState.subst, scope);
        //     const boundEnv = { ...tenv, scope: { ...tenv.scope, ...scope } };
        //     const bodyType = inferExpr(boundEnv, expr.body);
        //     return bodyType;
        // }
    }
    throw new Error('Unknown expr type: ' + (expr as any).type);
};

const inferPattern = (tenv: Tenv, pat: Pat): [Type, Record<string, Scheme>] => {
    switch (pat.type) {
        case 'any':
            return [newTypeVar({ type: 'pat-any', src: pat.src }, pat.src), {}];
        case 'unquote':
            throw new Error(`cant infer unquoteeeee`);
        case 'tuple':
            throw new Error(`tuple what is this`);
        case 'var': {
            const v = newTypeVar({ type: 'pat-var', name: pat.name, src: pat.src }, pat.src);
            globalState.events.push({ type: 'infer', src: pat.src, value: v });
            stackPush(pat.src, kwd(pat.name), ' -> ', typ(v));
            stackBreak(`Create type variable for name '${pat.name}'`);
            stackPop();
            return [v, { [pat.name]: { vars: [], body: v, src: pat.src } }];
        }
        case 'con': {
            stackPush(
                pat.src,
                kwd(pat.name),
                ' -> ',
                ...(tenv.constructors[pat.name].free.length
                    ? ['<', ...commas(tenv.constructors[pat.name].free.map((name) => typ({ type: 'var', name, src: pat.src }))), '>']
                    : []),
                typ({ type: 'fn', args: tenv.constructors[pat.name].args, result: tenv.constructors[pat.name].result, src: pat.src }),
            );
            stackBreak('Type constructor lookup');
            let [cargs, cres] = instantiateTcon(tenv, pat.name, pat.src);

            if (pat.args.type === 'named') throw new Error('named pat');

            if (cargs.length !== pat.args.args.length) throw new Error(`wrong number of arguments to type constructor ${pat.name}`);

            const scope: Record<string, Scheme> = {};

            if (tenv.constructors[pat.name].free.length) {
                stackReplace(pat.src, kwd(pat.name), ' -> ', typ({ type: 'fn', args: cargs, result: cres, src: pat.src }));
                stackBreak('Create new type variables for constructor');
            }

            for (let i = 0; i < pat.args.args.length; i++) {
                const arg = pat.args.args[i];
                if (arg.type === 'spread') throw new Error('pat spreaddd');
                let sub = inferPattern(tenv, arg);
                unify(cargs[i], sub[0], pat.src, `pattern type`, `type constructor arg ${i + 1}`);
                Object.assign(scope, sub[1]);
            }

            // const subPatterns = pat.args.map((arg) => inferPattern(tenv, arg));
            // const argTypes = subPatterns.map((s) => s[0]);
            // const scopes = subPatterns.map((s) => s[1]);
            // argTypes.forEach((arg, i) => unify(cargs[i], arg, pat.src, `pattern type`, `type constructor arg ${i + 1}`));
            cres = typeApply(globalState.subst, cres);
            // const scope = scopes.reduce((a, b) => ({ ...a, ...b }));
            stackPop();
            return [cres, scope];
        }

        case 'str':
            return [{ type: 'con', name: 'string', src: pat.src }, {}];
        case 'prim':
            return [{ type: 'con', name: pat.prim.type, src: pat.src }, {}];
    }
};

const instantiateTcon = (tenv: Tenv, name: string, src: Src): [Type[], Type] => {
    const con = tenv.constructors[name];
    if (!con) throw new Error(`unknown type constructor: ${name}`);
    const subst = makeSubstForFree(con.free, src);
    return [con.args.map((arg) => typeApply(subst, arg)), typeApply(subst, con.result)];
};

const n = (n: number, one: string, two: string) => (n === 1 ? one : two);
