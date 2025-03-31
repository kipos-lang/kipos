// Based on https://compiler.jaredforsyth.com/algw-s2

import equal from 'fast-deep-equal';
import { Src } from '../../lang/parse-dsl';
import { interleave } from '../../demo/interleave';
import { Type, Expr, Stmt, Pat } from './Type';

export const builtinSrc: Src = { left: 'builtin' };

export const builtinEnv = () => {
    const builtinEnv: Tenv = {
        aliases: {},
        types: {},
        constructors: {},
        scope: {},
    };
    const concrete = (body: Type): Scheme => ({ vars: [], body, src: builtinSrc });
    const generic = (vars: string[], body: Type): Scheme => ({ vars, body, src: builtinSrc });
    const tint: Type = { type: 'con', name: 'int', src: builtinSrc };
    const tbool: Type = { type: 'con', name: 'bool', src: builtinSrc };
    const t: Type = { type: 'var', name: 't', src: builtinSrc };
    const a: Type = { type: 'var', name: 'a', src: builtinSrc };
    const b: Type = { type: 'var', name: 'b', src: builtinSrc };
    const tapp = (target: Type, ...args: Type[]): Type => ({ type: 'app', args, target, src: builtinSrc });
    const tcon = (name: string): Type => ({ type: 'con', name, src: builtinSrc });
    builtinEnv.scope['null'] = concrete({ type: 'con', name: 'null', src: builtinSrc });
    builtinEnv.scope['true'] = concrete({ type: 'con', name: 'bool', src: builtinSrc });
    builtinEnv.scope['false'] = concrete({ type: 'con', name: 'bool', src: builtinSrc });
    builtinEnv.scope['length'] = generic(['t'], tfn(tapp(tcon('Array'), t), tint, builtinSrc));
    builtinEnv.scope['index'] = generic(['t'], tfns([tapp(tcon('Array'), t), tint], t, builtinSrc));
    builtinEnv.scope['unshift'] = generic(['t'], tfns([tapp(tcon('Array'), t), t], tcon('void'), builtinSrc));
    builtinEnv.scope['push'] = generic(['t'], tfns([tapp(tcon('Array'), t), t], tcon('void'), builtinSrc));
    builtinEnv.scope['concat'] = generic(['t'], tfns([tapp(tcon('Array'), t), tapp(tcon('Array'), t)], tapp(tcon('Array'), t), builtinSrc));
    // builtinEnv.scope['[]'] = generic(['t'], tapp(tcon('Array'), t));
    // builtinEnv.scope['::'] = generic(['t'], tfns([t, tapp(tcon('Array'), t)], tapp(tcon('Array'), t), builtinSrc));
    builtinEnv.scope['void'] = concrete({ type: 'con', name: 'void', src: builtinSrc });
    builtinEnv.scope['+'] = concrete(tfns([tint, tint], tint, builtinSrc));
    builtinEnv.scope['+='] = concrete(tfns([tint, tint], tint, builtinSrc));
    builtinEnv.scope['-'] = concrete(tfns([tint, tint], tint, builtinSrc));
    builtinEnv.scope['>'] = concrete(tfns([tint, tint], tbool, builtinSrc));
    builtinEnv.scope['<'] = concrete(tfns([tint, tint], tbool, builtinSrc));
    builtinEnv.scope['<='] = concrete(tfns([tint, tint], tbool, builtinSrc));
    builtinEnv.scope['='] = generic(['t'], tfns([t, t], tint, builtinSrc));
    builtinEnv.scope[','] = generic(['a', 'b'], tfns([a, b], tapp(tcon(','), a, b), builtinSrc));
    builtinEnv.constructors[','] = { free: ['a', 'b'], args: [a, b], result: tapp(tcon(','), a, b) };
    return builtinEnv;
};

export const typeToString = (t: Type): string => {
    switch (t.type) {
        case 'var':
            return t.name;
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

export type Tenv = {
    scope: Record<string, Scheme>;
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
        case 'con':
            return [];
        case 'app':
            return type.args.reduce((result, arg) => merge(result, typeFree(arg)), typeFree(type.target));
        case 'fn':
            return type.args.reduce((result, arg) => merge(result, typeFree(arg)), typeFree(type.result));
    }
};

export const schemeFree = (scheme: Scheme) => typeFree(scheme.body).filter((t) => !scheme.vars.includes(t));

export const tenvFree = (tenv: Tenv) => merge(...Object.values(tenv.scope).map(schemeFree));

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
    return { ...tenv, scope: scopeApply(subst, tenv.scope) };
};
export const scopeApply = (subst: Subst, scope: Tenv['scope']) => {
    const res: Tenv['scope'] = {};
    Object.keys(scope).forEach((k) => {
        res[k] = schemeApply(subst, scope[k]);
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
export type StackText = { type: 'hole'; active?: boolean } | { type: 'kwd'; kwd: string } | { type: 'type'; typ: Type; noSubst: boolean } | string;

export type StackValue = StackText[];

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
    | { type: 'stack-break'; title: string }
    | { type: 'stack-push'; value: StackValue; src: Src }
    | { type: 'stack-pop' };

export type State = { nextId: number; subst: Subst; events: Event[]; tvarMeta: Record<string, TvarMeta>; latestScope?: Tenv['scope'] };

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
    | { type: 'pat-any'; src: Src };

let globalState: State = { nextId: 0, subst: {}, events: [], tvarMeta: {} };
export const resetState = () => {
    globalState = { nextId: 0, subst: {}, events: [], tvarMeta: {} };
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
    return typeApply(subst, scheme.body);
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
        stackBreak(`Incompatible concrete types: ${one.name} vs ${two.name}`);
        // throw new Error(`Incompatible concrete types: ${one.name} vs ${two.name}`);
        return {};
    }
    if (one.type === 'fn' && two.type === 'fn') {
        if (one.args.length !== two.args.length) {
            console.log(typeToString(one));
            console.log(typeToString(two));
            throw new Error(`number of args is different: ${one.args.length} vs ${two.args.length}`);
        }
        let subst = recurse(one.result, two.result);
        for (let i = 0; i < one.args.length; i++) {
            subst = composeSubst(recurse(typeApply(subst, one.args[i]), typeApply(subst, two.args[i])), subst);
        }
        return subst;
    }
    if (one.type === 'app' && two.type === 'app') {
        if (one.args.length !== two.args.length) {
            throw new Error(`number of args is different`);
        }
        let subst = recurse(one.target, two.target);
        for (let i = 0; i < one.args.length; i++) {
            subst = composeSubst(recurse(typeApply(subst, one.args[i]), typeApply(subst, two.args[i])), subst);
        }
        return subst;
    }
    throw new Error(`incompatible types \n${JSON.stringify(one)}\n${JSON.stringify(two)}`);
};

export const inferExpr = (tenv: Tenv, expr: Expr) => {
    if (!globalState.latestScope || !equal(scopeApply(globalState.subst, globalState.latestScope), scopeApply(globalState.subst, tenv.scope))) {
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

export const tfn = (arg: Type, body: Type, src: Src): Type => ({ type: 'fn', args: [arg], result: body, src });
// ({ type: 'app', target: { type: 'app', target: { type: 'con', name: '->' }, arg }, arg: body });
export const tfns = (args: Type[], body: Type, src: Src): Type => ({ type: 'fn', args, result: body, src });
// args.reduceRight((res, arg) => tfn(arg, res), body);

const tenvWithScope = (tenv: Tenv, scope: Tenv['scope']): Tenv => ({
    ...tenv,
    scope: { ...tenv.scope, ...scope },
});

export const inferStmt = (tenv: Tenv, stmt: Stmt): { value: Type; scope?: Tenv['scope'] } => {
    switch (stmt.type) {
        case 'return': {
            const value = newTypeVar({ type: 'return-any', src: stmt.src }, stmt.src);
            if (!tenv.scope['return']) {
                throw new Error(`cant return, we are not in a lambda`);
            }
            if (!stmt.value) {
                stackPush(stmt.src, `return`);
                stackBreak('return statement');
                unify(tenv.scope['return'].body, { type: 'con', name: 'void', src: stmt.src }, stmt.src, 'early return type', 'empty return');
                stackPop();
                return { value };
            }
            stackPush(stmt.src, `return `, hole(true));
            stackBreak('return statement');
            const inner = inferExpr(tenv, stmt.value);
            unify(tenv.scope['return'].body, inner, stmt.src, 'early return type', 'return value');
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
                    scope: { [pat.name]: init.type === 'lambda' ? generalize(appliedEnv, valueType, src) : { vars: [], body: valueType, src } },
                    value: { type: 'con', name: 'void', src },
                };
            }
            console.error('not handling yet');
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
            console.error('not stacking yet');
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

const commas = (v: StackText[], sep = ', ') => interleave(v, () => sep);

export const inferExprInner = (tenv: Tenv, expr: Expr): Type => {
    switch (expr.type) {
        case 'prim':
            const t: Type = { type: 'con', name: expr.prim.type, src: expr.src };
            stackPush(expr.src, kwd(expr.prim.value + ''), ' -> ', typ(t));
            stackBreak(`primitive constant`);
            stackPop();
            return t;
        case 'array': {
            let t = newTypeVar({ type: 'array-item', src: expr.src }, expr.src);
            let at: Type = { type: 'app', args: [t], src: expr.src, target: { type: 'con', name: 'Array', src: expr.src } };
            stackPush(expr.src, '[', ...commas(expr.items.map(() => hole())), '] -> ', typ(at));
            stackBreak(`array literal with ${expr.items.length} ${n(expr.items.length, 'item', 'items')}`);
            for (let item of expr.items) {
                stackReplace(expr.src, '[', ...commas(expr.items.map((it) => hole(it === item))), '] -> ', typ(at));
                if (item.type === 'spread') {
                    const v = inferExpr(tenv, item.inner);
                    unify(gtypeApply(at), v, item.src, 'array type', 'inferred spread');
                } else {
                    const v = inferExpr(tenv, item);
                    unify(gtypeApply(t), v, item.src, 'array item type', 'inferred item');
                }
            }
            stackPop();
            return gtypeApply(at);
        }
        case 'var':
            const got = tenv.scope[expr.name];
            if (!got) throw new Error(`variable not found in scope ${expr.name}`);
            if (got.vars.length) {
                stackPush(
                    expr.src,
                    kwd(expr.name),
                    ' -> ',
                    '<',
                    ...got.vars.map((name) => typ({ type: 'var', name, src: expr.src }, true)),
                    '>',
                    typ(got.body, true),
                );
            } else {
                stackPush(expr.src, kwd(expr.name), ' -> ', typ(got.body));
            }
            stackBreak('variable lookup');
            const inst = instantiate(got, expr.src);
            if (got.vars.length) {
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
                Object.assign(scope, patScope);
                globalState.events.push({ type: 'infer', src: pat.src, value: argType });
            });
            stackReplace(src, '(', ...commas(args.map(typ)), '): ', hole(true), ' => ', hole());
            const returnVar = newTypeVar({ type: 'lambda-return', src: expr.src }, expr.src);
            scope.return = { vars: [], body: returnVar, src };
            stackPush(src, typ(returnVar));
            stackBreak(`Create a type variable for tracking early returns`);
            globalState.events.push({ type: 'infer', src: { left: expr.src.left }, value: returnVar });
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

        case 'app': {
            // console.log(`app`, expr.args.length);
            // if (expr.args.length === 1) {
            const resultVar = newTypeVar({ type: 'apply-result', src: expr.src }, expr.src);
            globalState.events.push({ type: 'infer', src: expr.src, value: resultVar });
            const src = expr.src;

            // if (expr.target.type === 'var') {
            //     stackPush(src, ``)
            // }
            const pre = expr.target.type === 'var' ? ['call to ', kwd(expr.target.name), ' '] : [];

            stackPush(src, ...pre, hole(), '(', ...commas(expr.args.map(() => hole())), ') -> ', typ(resultVar));
            stackBreak(`function call with ${expr.args.length} ${n(expr.args.length, 'argument', 'arguments')}`);
            stackReplace(src, ...pre, hole(true), '(', ...commas(expr.args.map(() => hole())), ') -> ', typ(resultVar));

            let targetType = inferExpr(tenv, expr.target);

            stackReplace(
                src,
                ...pre,
                typ(typeApply(globalState.subst, targetType)),
                '(',
                ...commas(expr.args.map(() => hole())),
                ') -> ',
                typ(resultVar),
            );
            stackBreak(`function call with ${expr.args.length} ${n(expr.args.length, 'argument', 'arguments')}`);

            const argTenv = tenvApply(globalState.subst, tenv);

            const holes: StackText[] = [];
            for (let i = 0; i < expr.args.length; i++) {
                holes.push(hole());
            }

            let args: Type[] = [];
            for (let i = 0; i < expr.args.length; i++) {
                const mid = commas(args.map(typ).concat([hole(true), ...holes.slice(i + 1)]));
                stackReplace(src, ...pre, typ(typeApply(globalState.subst, targetType)), '(', ...mid, ') -> ', typ(resultVar));
                stackBreak('argument #' + (i + 1));
                const arg = expr.args[i];
                const got = inferExpr(argTenv, arg);
                args.push(got);
                // const mid2 = commas(args.map(typ).concat(holes.slice(i + 1)));
                // stackReplace(src, ...pre, typ(typeApply(globalState.subst, targetType)), '(', ...mid2, ') -> ', typ(resultVar));
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
            // }
            // if (!expr.args.length) return inferExpr(tenv, expr.target, );
            // const [one, ...rest] = expr.args;
            // return inferExpr(
            //     tenv,
            //     {
            //         type: 'app',
            //         target: { type: 'app', target: expr.target, args: [one], src: expr.src },
            //         args: rest,
            //         src: expr.src,
            //     },
            // );
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
                const res = inferStmt({ ...applied, scope: { ...applied.scope, ...scope } }, inner);
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

const inferPattern = (tenv: Tenv, pat: Pat): [Type, Tenv['scope']] => {
    switch (pat.type) {
        case 'any':
            return [newTypeVar({ type: 'pat-any', src: pat.src }, pat.src), {}];
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

            if (cargs.length !== pat.args.length) throw new Error(`wrong number of arguments to type constructor ${pat.name}`);

            const scope: Tenv['scope'] = {};

            if (tenv.constructors[pat.name].free.length) {
                stackReplace(pat.src, kwd(pat.name), ' -> ', typ({ type: 'fn', args: cargs, result: cres, src: pat.src }));
                stackBreak('Create new type variables for constructor');
            }

            for (let i = 0; i < pat.args.length; i++) {
                let sub = inferPattern(tenv, pat.args[i]);
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
