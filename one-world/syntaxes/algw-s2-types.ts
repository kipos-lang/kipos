import { RecNode } from '../shared/cnodes';
// import { Src } from './dsl3';
export type Src = { type: 'src'; left: string; right?: string; id: string };

export type Prim = { type: 'int'; value: number } | { type: 'bool'; value: boolean };
export type Block = { type: 'block'; stmts: Stmt[]; src: Src };
export type TopItem =
    | { type: 'test'; name: string | null; target?: Expr; src: Src; cases: { name?: string; input: Expr; output: Expr; outloc: string; src: Src }[] }
    | {
          type: 'type';
          name: { text: string; loc: string };
          src: Src;
          constructors: {
              type: 'constructor';
              name: { text: string; loc: string };
              args: { name: { text: string; loc: string }; value: Type; default?: Expr }[];
          }[];
      }
    | { type: 'stmt'; stmt: Stmt; src: Src };
export type Stmt =
    | { type: 'for'; init: Stmt; cond: Expr; update: Expr; body: Block; src: Src }
    | { type: 'let'; pat: Pat; init: Expr; src: Src }
    | { type: 'expr'; expr: Expr; src: Src }
    | { type: 'return'; value?: Expr; src: Src };
export type Spread<T> = { type: 'spread'; inner: T; src: Src };
export type ObjectRow = { type: 'row'; name: Expr; value?: Expr; src: Src } | Spread<Expr>;
export type CallRow = { type: 'row'; name: { text: string; loc: string }; value?: Expr } | Spread<Expr>;
export type PatCallRow = { type: 'row'; name: { text: string; loc: string }; value?: Pat } | Spread<Pat>;
export type CallArgs = { type: 'named'; args: CallRow[]; src: Src } | { type: 'unnamed'; args: (Expr | Spread<Expr>)[]; src: Src };
export type PatArgs = { type: 'named'; args: PatCallRow[]; src: Src } | { type: 'unnamed'; args: (Pat | Spread<Pat>)[]; src: Src };
export type Quote =
    | { type: 'raw'; contents: RecNode }
    | { type: 'expr'; contents: Expr }
    | { type: 'stmt'; contents: Stmt }
    | { type: 'pattern'; contents: Pat }
    | { type: 'type'; contents: Type };
export type Expr =
    | Block
    | { type: 'if'; cond: Expr; yes: Block; no?: Block | (Expr & { type: 'if' }); src: Src }
    | { type: 'match'; target: Expr; cases: { pat: Pat; body: Expr }[]; src: Src }
    | { type: 'array'; items: (Expr | Spread<Expr>)[]; src: Src }
    | { type: 'prim'; prim: Prim; src: Src }
    | { type: 'var'; name: string; src: Src }
    | { type: 'str'; value: string; src: Src }
    | { type: 'quote'; src: Src; quote: Quote }
    | { type: 'unquote'; src: Src; contents: Expr }
    | { type: 'bop'; left: Expr; rights: { op: { text: string; loc: string }; right: Expr }[]; src: Src }
    | { type: 'lambda'; args: Pat[]; body: Expr; src: Src }
    | { type: 'tuple'; items: (Expr | Spread<Expr>)[]; src: Src }
    | { type: 'app'; target: Expr; args: CallArgs; src: Src }
    | { type: 'object'; rows: ObjectRow[]; src: Src }
    | { type: 'throw'; value: Expr; src: Src }
    | { type: 'new'; value: Expr; src: Src }
    | { type: 'attribute'; target: Expr; attribute: { text: string; loc: string }; src: Src }
    | { type: 'uop'; op: { text: string; loc: string }; src: Src; target: Expr }
    | { type: 'index'; target: Expr; index: Expr[]; src: Src }
    | { type: 'constructor'; name: { text: string; loc: string }; args?: CallArgs; src: Src };
export type Pat =
    | { type: 'any'; src: Src }
    | { type: 'unquote'; src: Src; contents: Pat }
    | { type: 'var'; name: string; src: Src }
    | { type: 'tuple'; items: Pat[]; src: Src }
    | { type: 'con'; name: string; args: PatArgs; src: Src }
    | { type: 'str'; value: string; src: Src }
    | { type: 'prim'; prim: Prim; src: Src };
export type Type =
    | { type: 'var'; name: string; src: Src }
    | { type: 'unquote'; src: Src; contents: Type }
    | { type: 'fn'; args: Type[]; result: Type; src: Src }
    | { type: 'app'; target: Type; args: Type[]; src: Src }
    | { type: 'con'; name: string; src: Src };

export function traverseStmt(
    stmt: Stmt,
    visitors: {
        visitExpr?: (expr: Expr) => void;
        visitPat?: (pat: Pat) => void;
        visitType?: (type: Type) => void;
        visitStmt?: (stmt: Stmt) => void;
    },
) {
    if (visitors.visitStmt) {
        visitors.visitStmt(stmt);
    }
    switch (stmt.type) {
        case 'for':
            traverseStmt(stmt.init, visitors);
            traverseExpr(stmt.cond, visitors);
            traverseExpr(stmt.update, visitors);
            traverseBlock(stmt.body, visitors);
            break;
        case 'let':
            traversePat(stmt.pat, visitors);
            traverseExpr(stmt.init, visitors);
            break;
        case 'expr':
            traverseExpr(stmt.expr, visitors);
            break;
        case 'return':
            if (stmt.value) {
                traverseExpr(stmt.value, visitors);
            }
            break;
    }
}

export function traverseExpr(
    expr: Expr,
    visitors: {
        visitExpr?: (expr: Expr) => void;
        visitPat?: (pat: Pat) => void;
        visitType?: (type: Type) => void;
        visitStmt?: (stmt: Stmt) => void;
    },
) {
    if (visitors.visitExpr) {
        visitors.visitExpr(expr);
    }
    switch (expr.type) {
        case 'block':
            traverseBlock(expr, visitors);
            break;
        case 'if':
            traverseExpr(expr.cond, visitors);
            traverseBlock(expr.yes, visitors);
            if (expr.no) {
                traverseExpr(expr.no, visitors);
            }
            break;
        case 'match':
            traverseExpr(expr.target, visitors);
            for (const c of expr.cases) {
                traversePat(c.pat, visitors);
                traverseExpr(c.body, visitors);
            }
            break;
        case 'array':
            for (const item of expr.items) {
                if (item.type === 'spread') {
                    traverseExpr(item.inner, visitors);
                } else {
                    traverseExpr(item, visitors);
                }
            }
            break;
        case 'prim':
            break;
        case 'var':
            break;
        case 'str':
            break;
        case 'lambda':
            for (const arg of expr.args) {
                traversePat(arg, visitors);
            }
            traverseExpr(expr.body, visitors);
            break;
        case 'app':
            traverseExpr(expr.target, visitors);
            if (expr.args.type === 'named') {
                for (const arg of expr.args.args) {
                    if (arg.type === 'spread') traverseExpr(arg.inner, visitors);
                    else if (arg.value) {
                        traverseExpr(arg.value, visitors);
                    }
                }
            } else {
                for (const arg of expr.args.args) {
                    if (arg.type === 'spread') traverseExpr(arg.inner, visitors);
                    else traverseExpr(arg, visitors);
                }
            }
            break;
    }
}

export function traversePat(
    pat: Pat,
    visitors: {
        visitExpr?: (expr: Expr) => void;
        visitPat?: (pat: Pat) => void;
        visitType?: (type: Type) => void;
        visitStmt?: (stmt: Stmt) => void;
    },
) {
    if (visitors.visitPat) {
        visitors.visitPat(pat);
    }
    switch (pat.type) {
        case 'any':
            break;
        case 'var':
            break;
        case 'con':
            if (pat.args.type === 'named') {
                for (const arg of pat.args.args) {
                    if (arg.type === 'spread') traversePat(arg.inner, visitors);
                    else if (arg.value) {
                        traversePat(arg.value, visitors);
                    }
                }
            } else {
                for (const arg of pat.args.args) {
                    if (arg.type === 'spread') traversePat(arg.inner, visitors);
                    else traversePat(arg, visitors);
                }
            }

            break;
        case 'str':
            break;
        case 'prim':
            break;
    }
}

export function traverseType(
    type: Type,
    visitors: {
        visitExpr?: (expr: Expr) => void;
        visitPat?: (pat: Pat) => void;
        visitType?: (type: Type) => void;
        visitStmt?: (stmt: Stmt) => void;
    },
) {
    if (visitors.visitType) {
        visitors.visitType(type);
    }
    switch (type.type) {
        case 'var':
            break;
        case 'fn':
            for (const arg of type.args) {
                traverseType(arg, visitors);
            }
            traverseType(type.result, visitors);
            break;
        case 'app':
            traverseType(type.target, visitors);
            for (const arg of type.args) {
                traverseType(arg, visitors);
            }
            break;
        case 'con':
            break;
    }
}

export function traverseBlock(
    block: Block,
    visitors: {
        visitExpr?: (expr: Expr) => void;
        visitPat?: (pat: Pat) => void;
        visitType?: (type: Type) => void;
        visitStmt?: (stmt: Stmt) => void;
    },
) {
    for (const stmt of block.stmts) {
        traverseStmt(stmt, visitors);
    }
}
