
# Named Arguments

tale as old as time, what do you do about lambdas.
I say, that directly calling a toplevel function puts you in magic territory.
So if the target resolves to a `var`, and that `var` resolves to a named-function-type,
then we're good.

# Typed FFI

Ok y'all, we're gonna need to talk about typed ffi.
when doing FFI, I don't want to be stuck with redefining all of the types if I can help it.
If the source language has any concept of type definitions, I want to be able to automatically
transform those definitions into the language's type definitions if at all possible.

I imagine that will look like:
- the source language has type annotations for stuff, which are [in a certain format] (that boils doing to JSON)
- the target language provides local type definitions for [the format of the source type definitions], and
  {a function for producing local type definitions from source type definitions}

when ~exposing something for ffi (might be automatic), we also expose (a) the type definitions and (b) recursively
any type definitions that are depended, pontentially including automatically generated ffi type definitions from
other languages.

I WANT to be able to provide typescript-defined functions (including the dsl3.ts) to my runtime, so I need an automated
way to produce JSON for their type definitions.

OK SO
what we do is: use a bundler to turn (dsl3) into a bundle.js and a types.d.ts
as if it were any old npm package
and then we have a way to turn types.d.ts into [json blob], which would be "part of typescript language support".
and then,
yeah, so there would be a "very-foreign" kinda thing that would let a (bundle.ts + types.d.ts) masquerade as
a ~normal-foreign module.

like we could have a languageConfig id='go' that's ... I mean I guess it could be defined in-world at some point,
but probably not for the moment. it would be defined in typescript.
And it would accept like a go package as a .zip file.

sooooo we would want to have a (once and for all) way to define the FFI cababilities between any two languages,.
so you'd need to have a ... module ... that is the "ts-to-js--" module
and there would be a registry somewhere.
I guess in the language configuration for js--



# ok
so I'm not going to do the full type system thing in ts.

BUT I can try out my algw-s2-return dealio,
and modify it to be permissive of some things.

ok, so where do I put the inferred type?
How about top right?
let's try that.

- [x] basic type inference
- [x] render it next to the top
- [x] need to debug type inference, if only I could
- [x] render type errors really
- [x] hover for annotations plssss
- [ ] get binops infering
- [ ] get .attribute and [index] doing reasonable things

- [ ] I HSOULD DO SPANS.. like the <Wrap> that I had going.

# Type thoughts

Error throw/catch
- we use constraints, e.g. if you throw SomeError, then the constraint appears:
  `*throw* is a supertype of SomeError`

I'd have to think about how that vibes with generics and inference and stuff.

hm because if you .. call a function...

```ts

const map = (ar, f, g) => {
    let res = []
    for (let item of ar) {
        res.push(f(item))
    }
    g()
    return res
}

// map's type would be something like
<Input, Output, FErr>(ar: Array<Input>, f: (v: Input) ={FErr}> Output, g: () ={GErr}> void) ={MErr}> Array<Output>
with constraints MErr is supertype of FErr, MErr is supertype of GErr
```
right?

seems like that ought to work...

how about eliminating them?

```ts

try {
    throw SomeError
} catch SomeError (err) {
    //
}


````

# Now on to type checking

we should be able to do some type checking.
a 'validator', as it were.

things I want to do:

- `.attribute` access ... hm.

So, if I want nice interactions with arrays and maps, we would go one way.
like if I want it to be well typed.

on the other hand, I want arbitrary json interactions.

I could do something like `one#two` means "get an arbitrary attribute"

can I have something like baby traits?
where only builtins are allowed to have traits?

we might only need a couple of traits.

Index<key, value>
Attribute<"name", value>

# Ok now parsing is in the picture, and guess what??

I want a sidebar debugger.
Suprisesee

- [x] have a basic thing
- [x] show AST as well

# Imagining a type checker for my js--

Honestly this is for like a js-+
because it would have tagged unions,
which work normally
but it would also have object literals,
which would be completely opaque

WAIT ok.
I could actually still do this for js--
it would just be "objects are all equivalent"
and "attribute access produces a new type variable".

in order to have tagged unions, we'd need ast-level support
for them. which I think I can manage.

yeah, then we can have nice things.
ALSO so I'll want to be able to represent warnings too.
should 'infer' be called 'validate'?
because it incorporates linting & type checking?

# Tables swith drop-indent

I think it needs to be an attribute of the row.
so that if you add a row in the middle, things don't get messed up.

unfortunately this invalidates current data.

OH WAIT: alternatively, I could say "table multiline has 3 states. all or nothing"
I kinda like that better. I think it will scan better too.

# Next up:

- [x] get tables parsing
- [x] all the fancy; named args, constructors, multi-bops, spreads
- [x] in a table, need to be able to do a 'drop-table' mode.

# Debug parsing

- [x] let's have the ability to show the parsed stuff pls

# Getting macroy

- [ ] need to be able to do ffi imports, so I can import the dsl functions
- [x] also need QUOTE SYNTAX PLEASE
  - how about @yes, @(yes please) etc?
  - so a 1-tuple gets elided, everything else is literal
  - and then ... unquote? what's our game there.
  - so then, how do we indicate semi-quote?
    - @@ raw cst
    - @ expr
    - @p(...) pat
    - @t(...) type -- except we don't have types atm
      - oh but we want it, right? in order to be able to do type inference
      - yeah.
  - also, unquote
    - ` unquote
    - ... I don't think we need to specialize unquote,
      because it will be clear from the surrounding context, right?
    - this means we can't have an unquote in a raw cst quote ... which is probably fine?
- [ ] might want the ability to do a "spread unquote", like `...a, which whould sploosh an
  array into a list of children.

- [ ] want to be able to reorder toplevels
- [ ] also need some evaluation

- [ ] show parse errors better...
- [ ] have a button to turn on "debug the parse"
- [ ] do we then go for evaluation?
- [ ] or type inference?

hello(one)
hello(:one:two; three:four:)
hello[one]
hello[:one:two:]
hello[:one:two; three:four:]

# Thoughts about locs being strings

gonna want `Loc` to go to just `string` instead of that whole thing.

I think I want something else, like another attribute, on the node,
that can tell me "where this came from", like "if this was on a macro"
or whatever. But it shouldn't be in the main data structure that I'm always
accessing.

# gittt

// @isomorphic-git/lightning-fs isomorphic-git buffer

looks like I can run git in the broser.
anndddd how much do I have to care about that...

I'll deal with it laterish

I'm not going to do any branching I don't think, so
I won't mess with merges

# To sum up:

1. macros are imported specially
2. ffi things are imported specially
3. a "Language" (configuration) has an ID & Name, and points to a single export from a module compiled by some other language (maybe the base language)

I wonder if it's important to specify ... the compilation target ... in the LanguageConfiguration... maybe I'll add that, or maybe not.

BUT the hash that we're hashing is like the hash of the final artifact, that javascript bundle that is produced and then stored.
DOES THIS MEAN that it's impossible to re-generate these artifacts?
hmm. that is kinda what it means, and I don't love that.
UNLESS ok so we ALSO want to like have a serialization of the code that went
into it on the one end. all the CST in their modules.
hmmm sooo another way to attack this is to integrate with Git, and say
"If you want to generate a new Language you need a clean git stage".

...

honestly maybe I can have ... git in the browser too.

# Hm
Ok, so if "langauge configuration" is just a single object that gets
produced somewhere, it leads me to ask "should I have a formal system for
an 'export', that is an 'artifact' that gets ... built.

Ok because I definitely want to be able to pull up a list of
"these are the languageconfigs that you might want to pull from".
BUT that could easily just be "here are the ones you recently used
or are currently in use by modules we know about".

# FFI

1) want to be able to say "this module + this exported name, compiled by this language config"
2) [-] want to be able to say "I'm gonna inline some javascript"...maybe? eh that
doesn't have to be handled by the IDE, it can just be an artifact of compilation.
Same story with like inlining some ASM or WASM or whatever.

:( ok, so having to specify the whole recursive languageconfiguration is
actually going to get old. Soo maybe we do need to be able to say
"this language config, by ID".

hmmmmmm.
ok hear me out, what if ... I just had a toplevel that was configured to use
a different languageconfiguration.
and that was how ffi worked.

because I have an aversion to making it so the parser/autocompleter etc. have
access to the list of languageconfigurations that the IDE knows about.

I'd kinda rather handle that in the IDE, for example by
--.
ok here's another idea, I could do the same thing as with macro imports.
just totally special case it.

hmmmm remind me why I'm not special-casing imports in general? idk
I guess I want to allow for innovation in that space too.

ok but FFI is special enough that I'm happy to make it special.

# the language

Ok now let's talk about how allowing languageConfiguration to point to
multiple things allows you to have different parts of it be
written in different languages.

Is that ... just a footgun?
you know, hmmm I think I probably want to handle that differently,
where I have an explicit FFI setup that you can use anywhere,
and then the "language config" is just a single artifact exported from somewhere.
and it can use FFI if it wants to.

Yeah I like that better. Then I can deal with the "how to have a well-typed ffi"
in just one place.

###

Alright let's talk about ... whether or not we need an IR step
I guess it could be like an `intern` step that does AST+TInfo -> IR

so the reason you would want a separate step for it, is as an optimization.
therefore, I can call it optional. and the default "intern" is just
to have [AST, TypeInfo] as a tuple.

## parser

CST -> AST
also produces /meta/ for syntax highlighting
and (error reporting?) because parse errors are local...

WAIT ok so we also want:
- macrooos
  - so a macro gets defined as operating on a given DSL key

is it premature to lock things down to my DSL?
wouldn't I want to support different algorithms?

OOOH OK SO hm, we could say that ... the parser expects macros in (a certain format), and the particulars of what that is are left open. Yeah.

I definitely want to be able to support rolling your own algorithm.
BUT
how does the parser know what macros it should be using?
we look to the module, and we hoist all `import` ... things ...
hm hrm hm I wonder if imports need to be ... treated separately somehow.
so that I know to parse them first, and that they don't have any macros involved.
definitely got to say that an importy toplevel can't have macros happening.

OK so the story is, if you want to do an import,
you add it to the imports section at the top.
BUT that section is still free-form, and handled by the parser.
BUT I think maybe we'll have a separate 'parseImport' function,
just to be clear about our types and expectations.

question: how nailed down to imports need to be?
also question: do we allow cross-module references without an import?
ok I think the answer is, you can do fully-qualified stuff, but the import
still needs to be listed at the top of your thing.

soooo parsing a module import
does it do resolution? or does it just produce a name,
and the IDE does resolution?
do we want to allow ... the language control over how they represent resolution?

also: module renaming / moving, how do we want that to be represented?

`a/b/c` is one way. `a.b.c` is another.

and you could imagine others.
Does that mean the `parser` needs to be queried in order

#### Lol ok start this again...

## parser

ok, first we go through the imports
also, can imports be nested in the same way?
like, can you do the whole "this toplevel has children" thing.
kinda why not, right

- walk the imports trees, figure out all the imports
- macro imports are special, and should be designated as such
  - what about importing a macro function as a function? is that possible?
    I mean I guess it's not strictly a function, right.
- import star probably means that we need to check for macros...

OK OK OK *alternatively*
we could just require that you declare the modules that you're importing
macros from at the module-level
and then other importy stuff is left entirely as an exercise to the user.
yeah, that seems better, and less...bespoke?

SO: there's a place to define "modules you are using macros from",
and we just grab all of the macros that are defined in that module.
DO WE want to allow re-exporting of macros? honestly probably
want to support both kinds.
given that macros aren't values, as such.

- languages should expose a `parseWithMacros` function for testing macros in the same module.

## More macro thoughts
it occurs to me that... doing macros that are "direct parser extensions" is materially different, because the macro does `CST -> AST` instead of `CST -> CST`.
This means that there wouldn't be a way to "show the macro-expanded code", which is a downside.
On the other hand, it should allow for more powerful & simpler macros, that better integrate into the rest of the parser; e.g. you can say "and now parse an expression" and it will do it.
So I think I'm happy with the tradeoff.


## parser, this time with feeling

- load macros from the modules specified
- call `parse` on the toplevels, passing in the macros

now ... from `parse`, are we able to construct the dependency graph?
seems like we would want to be able to.
which means that `parseResult` would want to tell us "this is an external reference"
and ... such like.

## inferrer

AST -> TINFO
also a mapping of (nodeid -> Type)
and a list of errors
and maybe a list of trace events, if we're in debug mode


## compiler

## evaluator

# parsing

let's talk about it.

I'm assuming I'll run the re-parse on input, right?
to what extent should it be ... async? seems like it could be

## So,

I have an editor. like. right?

- [x] longish refactoring of the history stuff to make it easier to think about
- [x] tmpText is gone
- [x] nextLoc is a function now
- [x] now ... we do a little rendering I think
- [x] thennn eedd a way to make new toplevels

- [x] gotta be able to click stufff
- [x] whyy am I not multiselecting?
- [x] wait undo isn't really workingat all
- [x] ok gotta write some tests y'all
- [x] next up, create moduleeee
- [x] gotta be able to wrap folks
- [x] TABELS
- [x] ; table split in the /after/ of a string, gotta handle that

- [x] better key handling, prepare for copy/paste
- [x] rename module

- [x] useEditor should just cache the editors
  did not fix 😭
- [x] found the missing dependency. ... which an eslint rule would have caught 😭

- [ ] HIGH LIGHT
- [ ] let's make up/down work
- [ ] clicking non-ids plsss
- [ ] click & drag would be good

- [ ] thinkin through macros n stuff
  - the if-let macro is maybe more ambitious

and... now do we get a little execution?
like let's hook up the aprser, get that sweet syntax highlight.

## Basic multi-top setup

- I can require you to click a toplevel to get selection there
- and require you to click a button to make a new toplevel
- not the nicest, but usable.


##

- [x] define types
- [x] figure out storage and retrieval.
  - localstorage?
  - localforage?
  - some leveldb abomination?
  - honestly probably localstorage until it doesnt work anymore
    and then localforage...
  - alTHOUGH, I could also say its serverside ...
    yeah ok once localStorage doesn't cut it, we implement
    serverside goodness.

The Big Dealio

What's the data?
- a module, is a list of ... toplevels? ok yeah we'll not deal with nesting toplevels at the moment?
  or maybe we can, might as well make it possible.
- So a module has, like a name or something. and a parent. and an ID obvs.

Tables:
module
- id
- name
- parent (might be `root`) // wait do we do ordering? hm. no just alphabetical.
- languageConfiguration
- toplevels
- roots[]

toplevel
- id
- children
- root
- nodes
(maybe plugin stuff)

languageConfiguration
- id
- parser
- type-inference?
- compiler?
  - includes some indication of compilation target (js, wasm, glsl, etc.)
- interpreter?

Q: what if type inference was expected to produce everything needed for compilation,
including, if necessary, the original parse tree?

##

- [x] Bring over ... cst editing stuff?
- [x] Bring over test files... and things they depend on.
- [x] yasss so good. all tests passing.
- [ ] bring over the hindley stuff.
  - [x] the reader/lexer
  - [x] the parser-dsl
  - the algw maybeeeeeeeee
- [x] directoyr cleanup
  - [x] move stuff from web/ and src/ into better places
- [ ] make a web UI dealio
  - gonna have to handle multiple toplevels, my lads.
    - that'll take a bit of doing, to be sure.
      - hopefully just to the first level of things that produce KeyActions
- [ ] make a file-based mode ... for good testing and such

oh nooooes, zed doesn't support coverage reporting.

...


# Question: do I want ... do mess with multiple package publishing stuff?

... I do, at some point, want to be able to publish a cli tool on npm
... and probably the web tool as well, on npm
... but these are end-user packages, and can just be bundled to a single js file.

Do I want to mess with shipping smaller packages? I certainly don't think so.
not at the moment.

BUT at present, the toplevel directory is pretty messy.


# Here's the basic idea of what I want to build

I'm thinking; put the CRDT stuff on hold for a minute; the tests should keep for now.

We make a little editor thing that doesn't try to do the hash-based addressing stuff.
Just modules.
A module has things in it.

A module has a selected language configuration.
A module can import other modules, and the imported modules get evaluated with the same language configuration as the current one.
Also ... like maybe tests are run as well? To ensure that the module you're importing is sane.

left pane: modules, in a tree probably
right pane: auxiliary stuff, like a
- keyboard input help pane (for help with the structured editor)
- undo/redo stack, visual clipboard
- parsing debugger (CST/AST view)
- type inference debugger (yay)
- execution debugger (classic stepping debugger probably)
- maybe a place to {pin} tests, or example outputs, or something?
middle pane:
- the module you're editing.

should also be able to do a "find all usages" of a given thing, and edit all of those at once ... somehow.

A LANGUAGE CONFIGURATION IS:
- a parser
- a type checker (optional)
- an interpreter (optional)
- a compiler (optional?)

Ok and these things are separately configurable, on a per-module basis, because they shouldn't impact
compatibility with other modules
- maybe a set of editor plugins
- a set of macros to be using, which are .. imported probably? yeah they have to be defined in other modules.

Annnnnnd I think we're breaking with the j3 repo.
Let's get going on kipos
