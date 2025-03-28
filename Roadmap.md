
# the language

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
