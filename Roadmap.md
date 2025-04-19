
# History Scrubbing how is it done:

- in `store`, we need to know if we're scrubbing
  - if scrubbing, ignore all actions/updates.

# Testing it

- [x] a test
- [x] try out isomorphic git backend, its working! nice.
- [ ] nowwww can we have some history scrubbing?

# For persisting

I think I'll do a thing where I synchronously persist
diffs to localstorage, and then debouncedly autocommit to git,
and once the commit has happened, we can clear from localstorage.

- [x] make store a real class
- [x] have there be an object whose job is to manage debounces and stuff
- [ ] let's go right to file systems, ok? idk maybe
- [ ] make a button that is `export the whole dealio` and it gives you a JSON file of all modules
- [ ] then make the switch, start fresh; and then do `upload that json blob`
- [ ] and now we're running hot.
  - oh wait when loading up the ... modules, we need to know what
    the most recent ... things are.

and nowww we'll abstract loading and storing?

OK FUTURE QUESTION currently I'm saying "toplevel" is the smallest single
unit of measure ... but would it not make sense to go with "node"?

IN ORDER TO make that possible
I would need to
haveeee the `Change` type ...
yeah I mean I would have to make writes slower for one side or the other...
right?
wait
I could
still send the full toplevel, but also send the "changed nodes" list.
yeah.
then I could support either one.

OK, with a little more record keeping, I should be able to equally support
[whole toplevel] and [broken out by nodes] backends.

honestly I don't know whether the "so many files" thing would be much worse, or just fine.

andddd I keep feeling like I'll want to write my own databasy backend. ...

# Ok so the way commits work

// initial ... repo
// a change ... is a delta

- {root}/modules/{moduleid}/module.json
- {root}/modules/{moduleid}/history.json
- {root}/modules/{moduleid}/toplevels/{toplevelid}.json

also ... the hash of the change includes the hashes of the modules
and the hashes of the modules includes the hashes of the toplevels

and like, for each toplevel, we need to be ... storing the hashed things?
hm. wait we don't, because we're storing the history deltas.
so how does that work?
-> like, you can rewind things to reproduce the hash of a thing?

ahhh. OKso.
critially, the "commit hash" is *not* a hash of the delta,
but rather a hash of the whole system, with the delta applied.

and so, we need:
- list of commits
- current state of the world, with hashes precomputed

And then adding a commit is just "apply the delta, recompute hashes,
and then use the final hash as the hash of the commit".

and, rewinding involves reverse-applying a bunch of commits.
switching to a new branch ... involves rewinding to the shared
ancestor and then applying and such.

## VCS

So, history, undo & redo will be in-memory things managed by the editor.

hmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm
ok what if I literally do want to use git
because it already has so many things solved.
and what if I just format things so that line-level diffs are fine.

so the module file is a newline-separated list of [attribute]\t[jsonified value]
and the toplevel file is the same
followed by a line for each node, with alphabetically sorted IDs
always with a trailing newline probably

issss this really unreasonable to do?
hm.
I mean what I'm currently doing is serializing a whole module to disk on every thing.
So doing that for a toplevel is probably fine.


## OOOH OK so here's how to solve the "browse files in git" problem
-> make a github pages thing? hm. but then you can't do historical.
  -> but also, having an automatic github pages story (github action?) sounds dope.
-> make a ... yeah honestly I guess reifying the text in a parallel file makes sense.




# OK FAM

I just want to say
that I want a way
to snapshot stuff.
and maybe it's just git
(?)

but also.
maybe I want to autosnapshot things?
like on a timer
and then
we can ditch snapshots that we don't need

ok and when we snapshot, we're going all in on hashing and structural sharing.

hm like I could still use git though, right?

AND you can select a toplevel and "scrub through" the history to compare things,
and `revert to this one` if you want.

AND you can have a global "history scrub".

SO: how about them commits?

Commit messages:
- should include tests passing/failing, as long as (all evaluations have coalesced)
- might include screenshots of pinned dealios? (maybe only do this for manual snapshots)

hmmmmm I think I might not *actually* want git.
At least, I probably want my own thing, which can be *lowered* to git, and *raised* from git as well.
but I can definitely do better on diffing.

yeahhh so the theoretical "file structure" would be
- {root}/modules/{moduleid}/module.json
- {root}/modules/{moduleid}/history.json
- {root}/modules/{moduleid}/toplevels/{toplevelid}.json

and that's it! right.

once we have vendored things, that might play into it. but not yet.

Currently our history tracking (undo/redo) is isolated to the module level,
and trimmed to like the last 100 changes,
and such.

could my notion of commits supercede history tracking?
OK ANOTHER THOUGHT, smarter undo/redo:
- if you do ctrl-z and your selection is in the same toplevel (or module?) that
  the most recent change happened, and the change was less than (5 minutes) ago,
  we just undo the change, easy peasy.
- BUT if it's been a while, or you're in a different module, then we enter "rewind mode"
  -> where there's a slider at the bottom of the screen, and you can switch between
    - whole project
    - this module
    - this toplevel
      -> might even want to be able to select multiple toplevels to rewind?
-> while rewinding, we: re-evaluate all the tests n stuff for you, so you can see
  what is happening.
b/c like if you're just rewinding one module, it might not get to the point where all tests are passing.

ALSO you should be able to navigate to other modules while in rewind mode, to see what execution
results look like over there.

## Editor experience thoughts:

- [ ] IF we have an error in a thing, I don't actually want to propagate execution down the line.
  AND I want to indicate somehow, for the downstream ones, that their execution is "paused" due to
  a parent being in a bad state.
- [x] when swithing from evaluation -> defintion, we need to clear the results
- [x] "blanks" shouldn't resolve to `undefined`
- [ ] suppress space from a blank
- [x] figure out why recompilation wasnt happening
- [ ] if the failure is with source code gen, not sure if I can/need to do the "stop the presses"


## Thoughts on blanks:

- should not block type checking. Should be an "anything"
  - ah but it can still be reported as an error. that's fine.
- should block code generation.
  - orr maybe should be a runtime error?
  - yeah let's block code generation. we don't have the infrastructure to do "hole propagation" well

- [x] type errors should always block re-evaluation


##

hmm.
so
arright folks, let's get this showing some sort of color or something.
eventually.

CONWAY MUST LIVE

So how do I do a little step action?

Options include:
- have a custom syntax thing that's like "run:" which does some magic
- have a button on the toplevel that's like "> run <" which does some magic
  - that would be an editor plugin, I do believe.
  -> probably both on the frontend and backend?
  - like it would (a) wrap the evaluation in some javascript code to do periodic updates, and (b) take over the display of the results, potentially.
- magically decide that if the shape of the data is /a certain way/, e.g. `{type: 'kipos:display', mime: 'something', value: 'idk'}` then we display it a certain way.
  -> that doesn't handle the issue of "how to do animation and such", but it's part of something. like we could do svgs and pngs and stuff.
- I could just make a builtin that's like `$$env.periodic(fn)`
  - idk it kinda appeals. could get something quick & dirty together.


# Social Media feedback on dependencies and such

https://x.com/ForrestTheWoods/status/1912337191327658250


# BACK ON TRACK

- [x] a little bit of imports working
- [x] let's re-evaluate modules when module dependencies change.
- [x] show test results in the top roundy thing
- [x] let's show test results in the module sidebar
- [x] module dependencies not quite cutting it
- [ ] let's have a debug sidebar showing module dependencies thanks
- [x] I want the module sidebar to indicate type errors and stuff
  - I also want ... to have the backend deal with files. right?
- [ ] make it so I can disable a module

- [x] MOCK setInterval and setTimeout so they get cleared on re-evaluation.
...
HOW do I make it so that `kipos.update` actually updates the thing we were coming from?
idk. for now, we have to pass it around.

- [ ] -


# DECISION
we don't override the #lang of things we're importing. we respect it.

ALSO it should be an error to import a language:plugin for a language other than what's being used.

# Modules and submodules

I'm thinking maybe let's not do the anonymous submodule thing.
instead, nesting w/o a module declaration is just cosmetic.

Then, submodules:
- inherit all of the imports of *all parent submodules*
- don't otherwise have an official relationship with other submodules; they can import and be imported, but again no circular module references

(hm I'm remembering that maybe one justification for anonymous submodules was the ability to have a different configuration...
 and honestly, yeah, why not allow you to have a submodule that doesn't have a name. no need to force people to come up
 with names if they're not planning on importing anything.)

# 🤔 language configs

was there somethign about how I ... wanted to discourage daisy-chaining a ton of language configurations?
well certainly I wanted to remove the possibility of "not being able to recreate the chain of bootstrapping".
There's the idea of: "it's this module/name under this languageconfiguration at this [git commit]".
but that feels ... too removed? idk.
the other thing to avoid: having to rebuild the ocean any time you start up the editor.
how to fix?
mayyyybe vendored libraries?
like a vendored library is immutable, and so you can hardcore cache stuff. You can also distributed precomputed
cached stuff with the vendored library, to save on postage.
yeah ok, so if it's like "this library exports a /languageconfig/..." it might also have precomputed it for you.
oooo hm. what iff.

what if a language is like a supermacro.
you can export a macro, you can export a language.
honestly it kinda makes sense.
you wouldn't really /import/ a language, probably. ... right? I mean you certainly wouldn't import multiple languages.
unless I come up with some kinda ... language composition model.
but yeah it's kinda like racket's "lang" pragma. (ok so racket's `#lang something` does `(require something/lang/reader [read-syntax])`)

yeah, having languages exports makes sense.
let's talk about noun verb agreement.
/does the language of the consuming module need to match the language of the importing dealio/

- for normal values, of course it does
- for ... languageConfigurations, of course it doesn't
- for macros ... like it does, right? or ... like it needs to match the parent language configuration?
  -> wait no. macros are written in the target language. that's the whole thing.
  -> but my macros are kindof like parser plugins, at least as I have them currently formulated.
  -> hm. should I have two different kinds of macros? like "this is a parser plugin" and "this is a cst-macro",
    where parser plugins actually need to be in the parent language, and cst-macros can be .. in any language.
  -> how about editor plugins? they can be in any language as well. they just need to speak a defined ABI

ehh. it feels quite weird to ... have a constraint of "macros" (parser plugins) be that they need to be
compiled with the same language that the current language was compiled with.
but then, how would you have any assurance of compatability?

ok but why not, actually.

yeah, I can totally imagine wanting to write plugins for the compiler, and the type checker, as well as the parser.
So why not make that an explicit thing that we provide affordances for?

honestly haskell has type checker plugins, that are enabled on a module-by-module basis.

so why not.

Q: where does that leave us with macros though?

yeah ok so that's the answer. we have plugins (parser, validator, compiler), and if you want to write them in the taregt language, you just need an FFI for (target -> parent), whihc should be doable.

ok, so thinking about just how that would work.
It seems like, if you're going to be declaring a `macro`, you also need to declare what language you want it to be a macro *for*, so that we can know what types to check against it.

so it would be like
```ts
macro name for (target language) = (something)
```
and so we would like typecheck (something) in the current language, and then (ffi:something->target) the result,
and then hand that off to (target language) to determine if it's a valid macro. If it is, we compile (something)
in the current language, and thne (ffi:something->target) the result, and now we have a macro!

So you could have
```
#lang mylang

```

waitwaitwait. let's say `mylang` is a language, and it is defined in `default`.
`mylang` would define the "type" of its macros, and that definition would be in `default`.
SO:
`macro mymacro for mylang = thedef`
and just to make it fun, let's say we're currently in `twolang`
So:
```ts
const parsed = twolang.parse(thedef)
const tinfo = twolang.validate(thedef)
const fftinf = twoLangToDefaultFFI.type(tinfo)
const minfo = default.validateEqual(fftinf, mylang.macrotype)
const mfun = twolang.compile(thedef, tinfo)
const macro = twoLangToDefaultFFI.value(mfun, fftinf)
```
and then `macro` can be passed to `mylang` as a valid macro.


UGH ok so that seems really annoying, right?
Could I flip that script?
instead, /ffi-import/ the types for stuff?
oh yeah, like

```ts
from "mylang" import {makeMacro} # ffi/lang=twoLang

macro name = makeMacro(something)
````

hmmm back up a bit. so the reallt straightforward way would be

```py
# module1, lang=mylang
specialIf = ...

# module2, lang=twoLang
from "module1" import {specialIf} # ffi/lang=mylang
from "mylang-impl" import {language mylang}
plugin:parser:mylang mif = specialIf

# module3, lang=mylang
from "module2" import {macro mif}
```

so we need a way to import a language, so we can ~use it for the purposes of type checking.

So, to simplify we might have
```py
# module1, lang=mylang
from "mylang-impl" import {language mylang} # ffi/lang=twoLang
plugin:parser:mylang mif = ...

# module2, lang=mylang
from "module1" import {macro mif}
...
```

yeah that seems sufficiently unambiguous.



then over in `mylang-impl` we would have
```py
# mylang-impl, lang=twoLang

language mylang = {
    version: 1,
    parser: myparser,
    validate: myvalidate,
    compiler: mycompiler,
    # These are types
    parserPlugin: Macro,
    validatePlugin: VMacro,
    compilePlugin: CMacro,
    ffi: [
        ...
    ]
}
```


OK LETS TALK FFI

- when declaring a language, you can also declare some FFIs, if you want.
  - when doing an FFI import (that is, importing a module whose #lang (B) is different than yours (A)),
    the editor will look for an FFI, which is responsible for (1) translating the types of (B) to (A)
    so your validator can work with them; (2) translating the /values/ of (B) to (A). If the imported
    values are functions, that will implicitly involve some converting of (A) stuff to (B) stuff, but
    that's just under the hood. Officially, the ffi will be "from B to A".
  - the editor will first look for FFI's that have already been imported (order matters here, sry)
    so you can do `from "something" import {ffi onelang-twolang}` or something
  - then it will check (A) to see if it has an ffi defined for B to A
  - then it will check (B) to see if it has an ffi defined for B to A
  (it's actually impossible for both A and B to have the ffi defined, so order doesn't matter in which we check first)

NOW HERE"S THE THING

if we need an FFI from langA to langB
and langA is implemented in langX
and langB is implemented in langY
then langA['tinfo'] is a type in langX, and langB['tinfo'] is a type in langY

So at the very least we need an ffi from langX to langY

```ts
// #langY
import {ATinfo, AValue} from 'ffi(langX:langY):langA'
import {BTinfo, BValue} from 'langB'

const ffiAB = {
    type(src: ATinfo): BTinfo,
    value(src: AValue, type: ATinfo): BValue,
}
```

🤔 ok so.
here's the thing. when I imagine making an FFI, ...
idk I imagine it being more ... like, operating at the level
of the runtime, not the level of the compiler. Does that make sense?
like this would apply to generated code, and not before.
well ok so the TInfo translation happens in the world of the validator.
that's for sure.
like ok, how's this:
we have a type, say `type Pet = Cat(string, int) | Dog(string, string)`
in langA, and a value `Cat("fluff", 7)` of type `Pet`.
BUT like the runtime representation is `["Cat", "fluff", 7]`.
AND THEN in langB, we don't have positional arguments, we have named arguments.
So it would translate to `type Pet = Cat{v0: string, v1: int} | Dog{v0: string, v1: string}`
and the runtime representation would be like `{type: "Cat", v0: "fluff", v1: 7}`

OK SO CRITICAL POINT: the runtime representation from `langA` *might not be a valid value in langB*.
but like, at the end of the day we need to deal with it.
does that mean you can only *write* ffi functions in languages that are capable of representing, at the
data layer, everything from both languages? It does seem that way.

and we'd need to ... generate the conversion function that looks like
```ts
function petAtoPetB(pet) {
    switch (pet.length) {
        case 3:
            switch (pet[0]) {
                case 'Cat':
                    return {type: 'Cat', v0: pet[1], v1: pet[2]} // might need conversions on pet[1] and pet[2]
                    // ...
            }
    }
}
```

🤔 I can imagine ... wanting to be able to customize the generation ...
ould there be a way, in like the import declaration, to indicate custom translation functions?

ok so one thing you might decide to do, is say 'only functions withi primitive arguments and return values are allowed'.
and you could limit things like that.

or "no generics allowed"

OK BUT

if we're implementing `langA` in `default`.
then langA's AST is defined in `default`.
and like, default will have to have imported its own AST ffi'd somewhere. right?

OK BTW so like.
if your language includes quoting. then the `type` of the quoted expression is gonna have to be like,
`from {thismodule} import (AST)`.
Right? which is a little funky.

yeah, what's the ... type ... of ... that.
I mean. I guess the TInfo is ...

ok anyway, do I need to solve this now?





The same would be true for compiler plugins and validator plugins.

BUT on the other hand, /languages/ and /editor-plugins/ only need to interact with ...the IDE's JS api.

# Alright, that was quite a diversion.
now we're back, types are checking, and we're just about ready to ... have modules depend on each other.

ok, so
- we parse everyone's `imports`, no macros needed
- this gives us a definitive module graph
- we then go through one by one, ... hm parsing where we can, and evaluating macros where we must.
  but the problem is that macro evaluation is ... async.
  Ok we pretend it's sync for the moment.

hrm ok. so we have sorted stuff.
BUT these import stanzas, we've gotta track things down a bit better than that, right?
what I'm thinking is this:
- headDeps shows the local head deps, but I also need like a `importDeps` or something.

when editing, parseInput can have knowledge of the exports of other modules, and lock things down.
but during first parse, we can't. so we have to account for that.
(although we can have knowledge of the names of other modules, so lets lock that down fo sho)

- [ ] pass in module names to resolve at import time

AGH ok so parsing shouldn't do validation at the same time. parsers should parse, validators should validate.


- [x] parse imports
- [x] validate imports, resolving names and such
- [ ] When validating normal toplevels, I'll need to check imports for additionally matched things.
  and then pass in the ... foreign type info.
- [ ] thennn when compiling, do it all again!


# Let's think about monorepos

The question being: do I limit the editor to editing a single "package"?
This seems like a thing that would be fine to do. Right?
I can revisit later.

# Access control

Yeah so here's what I want for access control:

Package = a versioned thing that gets published
Module = a namespace, corresponds to a 'file'
Submodule = a subnamespace, a section within a file

Each module has a default toplevel submodule.

- public (available outside of the package)
- internal (only within this package)
- local (within this module or any submodules)
- private (only within this submodule)

*thinking* should I be able to mark modules as private?
I don't think we need to...

Although, it might be useful to be able to mark a submodule as private?
or rather, as "local". hm, but then that would make marking something as "public" meaningless, right?

Maybe you could ... set a flag at the module level (or package level?) that would determine the "default" access level of any definitions?

hrmhrmhrm.
So, langauges would have opinions about what the default is, presumably.
But also, users would have opinions.
And modules could be cross-language.

So it should really not be specified by the language.

ok I'm actually not going to bother with "customizable defaults" for the moment.
maybe I'll come back to it.

# Module Dependencies

so my editorstore is nice, but insufficient.
also it's not really doing too much work by itself.

Soo I think I need it to be in charge of all the modules
at once, as well as the compiler.

# Macros and Imports

So the thing is, we want to be running macros at parse time,
but the compiler and stuff all live in the web worker.
THIS MEANS that if we're gonna have a macro or an editor plugin,
the compiler needs to yeet back an evallable javascript bundle.
and then we `eval` it on this side of the pond.

# IMportss UI

gonna be parsed, why nott

## As a Codes

from (autocompleted-ref) import {a; b; c; d}
from .

vendored URLs ... should be to a manifest file,
which includes a name & version.

soo if you have a ... 'ref' node, it's not an ID node.
and it shouldnt be editable.

ok so what iff .
the imports section is ... using the structured editor, but
the CST is not the source of truth; the AST is.
that would be a cool way to do it.

AHH OK so.
Here's the thing.
We'll have /imports/ toplevels.
anddd they'll be ... parsed differently?

OK ALSO if a submodule is /unnamed/, it just /inherits imports from up the chain/. Once it has a name, it has to be disciplined about imports.

thisss also means I can let the masses decide what their import syntax is yay.

ALSO:
- in the parseResult, have the ability to report ... "lockdowns", that is, "convert this /id/ into /ref/" ... or honestly maybe any kind of change you want.
Lockdowns then get applied, maybe when you unfocus the toplevel? Or something like that. Or we could have them be opt-in, depending.

BUT this does mean I want a node type that is /ref/, which would be an uneditable unselectable block.
ok but I don't ... quite ... need to do that just yet.
yeah that can wait.

So, I need the /module/ to have ... an /imports/ section.
which we parse before we parse anything else.

ok y'all. imports is now a list of toplevel ids.

## As a Form

`from x import {a, b, c}`
anddd I do believe I want a way to import *

OK ORDER OF OPS

- [x] a basic way to ... modify imports
- [ ] now incorporate them ... into evaluation?
  - ideally, should only re-evaluate items that depend on added/removed imports


# Grand Master Plan
What am I working towards? Probably ... macros?
yeah. that'll test a bunch of stuff.

INCLUDING:
- [ ] ffi types y'all.
- [ ] and ffi values. for the dsl3 stuff
- [ ] and, like, imports

Ok we'll do normal imports firsttttt

arright.

## Lift the compiler

thisss is where I want to have had tests for stuff.
ok but its fine

so,
i've got all these interfaces.
the EditorStoreI - the only thing it's doing is caching selectionStatuses.

Ok, so game plan:
- transition all of the `makeEditor` stuff over to ... hooks that
  maybe just access the store?


- [x] lots of things out of makeEditor
- [x] useSelectionStatuses
- [x] fix highlighting of spaced stuff
- [x] useTop is gonee
- [x] now to make a useUpdate fnn

hm what's next.

- [x] preload all the modules
- [ ] importtttts


## ORder of operations:

- [ ] vendored imports, because we ... don't have to build them?
- [ ] eh ok I think I need to lift the compiler story a bit first.

-

- [x] much better hover situation
- [x] drag and dropppp modules
- [x] collapsable modules


### NExt up: defining imports

... in order to do that well, I need to have all the other things evaluated. so I can know what I can import.
OK. so yeah, we're doin normal imports baby.

- [ ] lift the compiler (and parts of the editorstore?) up to the App level
- [ ] always compile everything
- [ ] cache the parsing at least, and maybe more stuff
- [ ] show in the module sidebar what has passing tests?
- [ ] allow you to "disable" a module, excluding it from compilation n stuff


# Let's talk FFI

When using a module w/ a foreign language, there needs to exist:
- a thing that does the compatability. that takes (types from that language) and translates them to (types from this language)
and values as well, for that matter.

This seems like the kind of thing you'd want to define once, and have apply generally.
/however/ I can also imagine wanting to "try out" a new compatability layer in just a single module.
So I'll leave the door open for that.

For the /vendor/ thing, for now I'll just, like, let you type in anything.

Things I'll make available as "builtin" vendored stuff:
- `builtin:dsl`
- `builtin:cst`
- `builtin:ast` <- the builtin language

oh hey, but I can make those available in the builtin-language, so I don't have to mess with FFI stuff yet.
that is nice.

# Imports

Things that are special:
- macros
- editor plugins
Neither of those get ~made available at the language level, so we don't need to worry about, like, scope issues.

Macros do have the potential to have ordering issues. so there's that.



#

I should really write up my thoughts about the architecture here.
in a way that other people can comment on.

#

PROBLEM. Expression (src) IDs are not stable between parses.

# TEStss

- [x] yay
- [x] want to show the pass/fail inline (with outloc)
  this is ... annotations, right?
- [ ] clicking the /fail/ should show a popover, allowing you to show a diff
  - hmm I wonder about, like, having a display setting to "show failures inline" or something
- [x] clicking a toplevel should select it somehow.
- [x] there should be a way to specify the /function to run/
- [x] tests should isolate filures in the input & output evaluation

- [x] test annotations are ... waffling?

- [ ] gotta lift the `compiler` to the main store level, not the editorStore.

- [ ] make it so you can place the "check mark" somewhere other than the (otherloc)
- [x] make a popover explaining the datas
- [x] make it so you can replace the (otherloc) with the (actual) with a click
  - this one

- [x] table backspace isnt owrking?

OK I really need to get hovers under control.

1) [x] centralize it again:
  - when showing a hover, need to check up the tree to see if there are errors/warnings that need to be shown
  - if you click, it should cancel the hover.
  - keydown should dismiss for goodness sake.
  - bad to have multiple hovers be able to be active at once



# Modules and dependencies

is module resolution / dependency whatnot, something that I want to leave up to language implementors?
or rather, do I want to allow it to be iterated on?
seems like there are some definite tradeoffs

regardless:
- I do think I want there to be the concept of /vendored/ dependencies (of which ffi deps are one)
  - these are /not/ editable directly, and are referenced by their unique /hash/
  - this allows for sharing / deduplicating.

How easy do I want to make it, to ~migrate version numbers of a vendored dependency?
IFF every module has a hard link to their vendored dependencies, then making that
update would be tedious.

Sometimes, you might want the dependency to be ~scoped to a single (sub)module.
Other times, it will be shared with the whole tree.

oooooh ok here's an idea. WHAT IF, if any of the /types/ of a dependency are ~leaked,
then that dependency has to be ... hoisted? or something?
ALTERNATIVELY that dependency could be marked as /private/, meaning that any leaked
types are "opaque" outside of the module.
that seems kinda cool.


# Loading from where?

I'm imagining the ability to send somebody a link like kipos.org/view/gist.github/303303
and it will ask you
- view this read-only
- persist in browser
- persist to a local (or remote) server

it would be ... nice ... if I could allow a language backend
to persist /execution results/ (for interacting with) in like
and sql database if they wanted to. for like a pandas DataFrame


# Validator - know where a reference resolved from
will be necessary for codegen

- [x] give all AST nodes unique IDs (put it on Src, yay)
- [x] make Tenv scope know where something comes from
  - ergh this is where my lack of unit tests comes to bite me.
- [x] when resolving a `var`, link the usage back
- [x] hang on to those resolutions as ValidationInfo
- [x] track module through somehowwww
- [x] do a little compiler
- [x] nowwww let's toss that into a web worker pls
- [ ] want to restart the worker when its ded
  - [ ] anddd that means we need to like load up the infos again, right?
- [ ] aslooo, we want to handle multi module situations
- [x] BUG mutual recursive values aren't being exported

- [ ] testssssss

- [ ] hovering something that has a warning or error should ALSO bring up the warning or error.

- [x] debug sidebar type inference, fix it
- [ ] parse debugging, would be good to have that enableable.

- [x] indicate errors happening at different levels
- [x] IF a toplevel /fails/ to execute, we need to pause any downstreamers.
  like they can type check, but should not execute

- [x] I also super want tests. definitely tests.
- [ ] additionally, if it's not too much trouble, persist the files to the backend.

- [ ] modules ... I need to do a dependency graph of modules too

WHAT ABOUT SUBMODULES
you know what, I think I do want submodules.
In fact, which if I use nesting as being submodules? that seems kinda natural, right?
a module can be anonymous, in which case it can't really be referenced
but it can also be named

ok so you can like have a definition, and the anonymous submodule inhabited by the toplevel's children
has like ... documentation? and tests? that's kinda cool.

OR you could have a docstring toplevel, and have the submodule be named, and the docstring is the documentation for the thing.

## A Little Compiler

- [x] want to be able to show in the debug sidebar ... the compiled output of a thing.
  - this would involve ... putting a `listener` on the compiler probably


# COMPILE

compile/link/exec?

and can that encompass the 'eval' case as well?
seems like the whole compiler should be on the other side of a bridge (websocket / webworker)

also, type inference scope should know if something comes from (builtin | toplevel | import)

also we want to be able to batch executions, probably by module? So we can rerun all the tests in a module at once.

andddd something about determining if a given toplevel is ~serializeable. so it can be cached instead of recomputed.

///

What would this look like for:
- js (mut vs immut)
- wasm
- python
- go

----

compile : (IR) -> ...

ok, so if I want to do "whole program optimization", the "compile -> link" story gets weirder. Right?
For example: if I want to monomorphize generic functions.

would I just ... have a different "link" story, and do more of the compiling there?

ALTERNATIVELY
we could leave this up to the compiler, right?
simplify the interface to:

"here are the updates ... let me know what you find out"
so (intern) is also irrelevant to our purposes.
we'd provide the compiler a way to cache things if it wanted.

but we don't actually need anything beyond:

`evaluate`

right?
I guess at some point I might want an `export` function.
ok so we're lookin at some persistence here.
So, `compiler()` returns an object that is expected to have
some persistence.

EditorStore is working at the level of an individual module.
but we're going to need to think bigger.

# So a compiler

Do we ... give it the whole dependency graph? each time?
because it needs to be able to know what should be brought in.

update(moduleId: string, deps: Dependencies, tops: Record<string, {ast: AST, info: ValidationInfo}>)

...

and then it responds with ... like ... "toplevelOutput: {id, data}"

right?

NOTE: Dependencies should encapsulate cross-module deps as well.


# Thinking about modules

Ok I do think that imports should be defined outside of parseable syntax.
can have much better autocomplete that way maybeee and definitely automatic updating of stuff for renames,
and also auto-importing stuff

# Major usability things:

- [x] up/down arrow keys
- [-] click anywhere to select
  - [ ] it doesn't really work, needs some tuning
- [ ] click + drag
- [ ] alt / ctrl arrow
- [ ] move between toplevels
- [ ] enter to create a new toplevellll

# Ok but let's be running...

Do I have a way to indicate that a toplevel should be evaluated?

- definition
- evaluation
- test

this locks down that you can't both define and evaluate in the same toplevel.

loc(something, 'name')
ctx.ref<string>('name') <- gives you the loc of the node

- [x] we need to put the multi-stmt thing into validation inferStmts so we
  correctly generalize stuff.
- [x] ok, so: error reporting. gotta get the `src`s right.

...

- [x] get updates working
- [x] make sure errors still make sense?
- [x] make parser indicate (definition | evaluation | test)
  - this is helpful for ... dependency cycle determination, right?
- [ ] make validator ... know what's a definition vs evaluation vs test? idk if that's critical
  - or maybe just `validateGroup` vs `validate` idk
- [x] let's indicate mutual recursion groups, pleease
  ya know, we could just number the toplevels
- [x] if a toplevel /leaves/ a recursion group, the other members need to be notified

- [ ] show the dependency graph in the sidebar please

annnnnd also evaluation, rite

# THinking about fixture tests

could be a input plugin?
can input plugins do that?
might have to be something special.
What I'm thinking of for input plugins is:
- it can present an alternative UI
  - and embed CST nodes as well
  - and it /reduces/ to CST nodes, which are passed to the parser.

But a fixture tests thing would want:
[fn under test]
[Pass/Fail] | [name] | [input] | [expected]

And if output differs from expected, want a way to
update the [expected] with that output.

(optional additions include: "a fn to convert the output to CST ndoes" and "a fn to compare output to expected")

ALSO I want to be able to ... select an individual test for (tracing) and (coverage display)

so it seems like that would be .. a custom toplevel somehow.

OR ... I could have a special CST node type that's like ... 'this should be ... replaced at render-time
with some output'.
Is that possible? hm. No, it would have to be the full "compare and maybe update". Which is pretty specialized.
OR WAIT it could be ...
like an output-only node, right?
yeah ok: so ... there's a ... cst node type, which is like a placehodler. And there's a ... function at runtime,
which you can call, with ... the cst or whatever that should populate that placeholder.

Thenn all we need is also a way to have an onclick function that updates the value in the [expected] column with the
actual output.

# Deep Dependencies

now we want a function to go through the dependency graph, and make it deep.
Top down? or bottom up?

top down: we would ... keep a list of the places we'd come from? and add to each of them in turn.
bottom up: we would need a reverse mapping (parents), and we'd keep a ... list of the path we'd taken so far,
which we'd add at each spot.

Ok, so now whenever we /update/ a thing (if the dependencies don't change), we:

- make a


# EditorStore

Ok, so....
there's some initial 'set everything up'
which is maybe just 'parse everything'

and then there'll be an `update` function
which will impact 1 or more toplevels.

then we'll re-parse and potentially re-graph
things.

and then we traverse the graph, doing first validation
and then evaluation.

- [ ] initial parse
- [ ] something updates the module,
  and determines what has changed.
  but that's not the editor store.
  - that thing tells the editorStore to recalculate (parse)
    and such. and then we do it.



editorStore.constructor() ...
  .update(topIds: string[])
    -> for each updated top, reparse
    -> if any updated top has different external references
       from before, (adjust the graph | rebuild the graph)
    -> then we ... hmm ...
       if there are multiple changed tops, we need to determine
       the proper traversal. potentially merging deep dependencies lists.
       but anyway, once we've made a total ordering of all the tops that
       need to be re-type-checked & re-evaluated, we do that.

  at the same time, we expose a list of ... changes.
  like, nodes whose meta has changed, or spans[][] have changed, stuff like that.

Q: we can skip re-type-checking iff all dependencies types haven't changed.
... I'll want to expose a way to ... determine if that's the case.

Other things to keep in mind:
- [ ] supporting (trace)s
- [ ] supporting coverage indicators
- [ ] some kind of tests setup. probably fixtures based.



#

arright
So now, parsing will do ... resolution for us, at a local level.
the next thing, is we need to ...
...
ugh
ok, we need to set up the whole like graph and stuff.

ok, so, we load up a module.
and then we parse everything in it
and then we construct a graph
and then we do type checking on everything
and then evaluation on everything, presumably
and ... through it all, we can tell react about it

andddd some quantity of this wants to be happening in a webworker?
definintely the evaluation, but probably the type cehcking as well
and maybe parsing? idk I want parsing to be veryyy responsive

Ok, hmm. The current `store` stuff feels ... too tied to react n stuff?

# Scopings

- [ ] when I .. have my cursor over a node, and it is a definition
  or a reference, the other paired things should be highlighted.
- [x] also indicate unused variablers htanks

... sooo ... toplevel lack of use is a nonlocal property.

- [ ] OH can we have an up/down please?
- [ ] I guess we'll need click-to-select overall as well...

...
so, first off:
...
let's override the `Meta`
of nodes that are declarations.
...
and unused ones, let's make that clear too

# ALRIGHT
so, now we get to the part of the show
where toplevels can depend on each other
for type information.

- [x] we have some persistence-of-errors issues here

And thennnn I'll look into the ... dependency stuff?
questions include:
do I ... enforce a single namespace on everything.
that seems a bit reductive.

ok so I guess ... what we'd do is say:
'your toplevel depended on [these things],
and [these toplevels] claimed to provide them,
do now I've given you [the infos] from those
toplevels, and you get to work things out.`

That feels like a good match of flexibility & structure.

# Other interesting runtime-representation-things

- having builtin support for CRDTs. in some interesting way.
  like make it really easy to say "this type is crdt'd"

# Debuggging values like we mean it

What would it mean for a language to provide unexpectedly helpful value debugging?
- make it really easy to pull up a graph of the code, and to trace
  "where are all of the places this data could have originated"
- make it really easy to attach a stack trace to an object...
  like a `getTrace()` function that gives you a uuid that the
  debugger can then reconnect with the trace of how you got to where
  you were
- automatically track runtime provenance of ... all values? or something.
  or be able to mark a ~type as provenance-tracking.

# DSL should handle references & products for me
at least somewhat.

// so, some understanding of ... scopes ...

Kinds of scopes that there can be:
- [ ] nonrecursive: things can only be used /after/ they are defined, and cannot be recursive
- [ ] unordered: anything within a scope can use anything else
- [ ] ordered: things can be used after *or within* their definition

In order of "how much of a hassle is this",
- ordered definitely wins
- unordered requires some bookkeeping for "this might be defined later
  and we'll match them up"
- nonrecursive requires you to be able to /defer/ the resolution of something
  until after the value, which seems annoying.

So I think I'll just do ordered for now.


I want something like `this is a scope, it makes a new scope`
and I would do it at the:
- `block` (maybe)
- `lambda`
- `the case of a switch`

SCOPES can be `ordered` or `unordered` or `nonrecursive`.

a nonrecursive scope would need ... some extra mucking about
to be able to say "patterns after this


OK but I also need something like a `recursive-scope` or maybe
a `self-scope`.

# Ok I need constructors
which means I need deftypes?

- [ ] parse errors don't really show up...


# Wpans
we need to ... have `useNode` respond with `spans` that we get from parsing.
and it's just the spans for the children. of the node.
so it could be like a list of spans.
and it could be a string[][], one for each child.

spans are great. wraps are great.
IFF there's an expr that spans multiple items of a non-smoosh non-space list, we will need
to fix the RenderList to make spans for it. just fyi

# I had a thought
about mutability

for js--, where mutability might lurk around every corner,
we just say "cache nothing. re-evaluate literally everything all the time".

For a hypothetical js-, where we have really good mutability tracking, we might
be able to label toplevels as "safe to cache" and "unsafe to cache".


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
- [x] get binops infering
- [x] get .attribute and [index] doing reasonable things
- [x] I HSOULD DO SPANS.. like the <Wrap> that I had going.
- [ ] and now objects

ok trying to figure out types for ... dsl3.

- [ ] ok and before I do real good imports, I can make some builtins, its fine

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
