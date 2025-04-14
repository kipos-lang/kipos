Extracted post





WHAT if we just don't allow breaking? like you have to do a clean break if you want to break. "A whole new ... world"
in the "go" sense of things.

🤔 need to think about how "reverting" works; like if you publish a version that breaks a thing, and then want to un-break it, what does that look like?






Context:
almost no language's compiler has first-class "knowledge" about the division between libraries. At compile-time, there's no difference between "a file in the project" and "a file in the library".

Assumptions:
these is a difference between "internal" code (not subject to versioning / "breaking change" constraints), and "public" code

we want to make it easy and natural to limit the maintenance interface of a library as much as possible

---------------

# Validated Versioning
automated versioning you can actually trust

[summary of the previous post "Why does your compiler pretend packages don't exist?"]

I take a look at JavaScript, Go, Rust, Java, Swift, OCaml, Python, C#, C, PHP, Elm, Haskell, Koka, and Scala, and in *almost every case*, the compiler is completely oblivious of the concept of a package (a versioned collection of modules that is separate from my project and from other packages). This is a severe oversight that makes package management much harder than it needs to be.

[/summary]

Here's where I talk about the better way.

Upgrading dependencies is a huge chore, and as a result, I pretty much just don't do it.

When, on occasion, I am forced to by external pressures, I'm reduced to a relentless series of "let's twiddle these numbers and see if this works", yet again reminding me of why I never do this.

The culprit? Nearly all of the burden for determining cross-version compatability of a library is left up to human judgement, which can very wildly.

There are two parts to making this much better than it is:

1) provide language-level mechanisms for dramatically reducing the "public surface area" of a package
2) automatically determine & report cross-version compatability via both static types and unit tests

## Limiting public surface area

The language that comes closest on this is Rust, with OCaml+dune being a fairly close second. Both provide a mechanism for limiting which modules in a package are exposed to consumers. However, they don't provide a mechanism for distinguishing between "a function that is exposed within this package" and "a function that is exposed to consumers". You can get around this by defining "public-facing" shell modules whose only purpose is to import definitions from other packages, but this seems like an unnecessary amount of ceremony for something that a compiler ought to be able to understand.

Swift gets some bonus points for having explicit access control distinguishing between "package" visbility (visible to other modules within this package) and "public" visiblity (visible to consumers), but it loses those points for not having nested namespaces, and for only having "glob imports".

Why is it so important to be able to limit the public surface area of your library?



I'm in the process of writing a programming language, one thing that a lot of languages seem to just punt on is package management. In nearly every language I surveyed,

or something

"If the types are backwards compatible,
 and the previous version's tests pass,
 and nothing public has been removed:"
 - then it is an "auto upgrade", e.g.
   when upgrading libraries, we skip over
   auto-upgradeable versions.

I want my tooling to:
- unless I specify, all packages are locked down
- have a button that says "upgrade packages"

A library specifies exact versions for its dependencies.
The consumer of a library is allowed to override those,
but it's on you.

/if a library uses another library, but uses it /privately/, that is,
 it doesn't expose any types from that sub-library, it is allowed to
 not use the same version as other stuff/

BUT ALSO
I want my tooling to be able to "auto-upgrade everything to the latest
versions that still have passing tests all around"
And then if I want to advance beyond that, I'll need to upgrade
stuff...myself.

DO I ALLOW you to "use a library in a broken way"? No I think not.
If you want to do that, fork it and disable those tests.

SO: you can /override the subdependencies of a library/, but only to
the extent that all types still check and all of the library's tests
still pass.
If you want to go beyond that, you have to fork the library.





Who on here thinks a lot about dependency management? I think it's ridiculous that most compilers are oblivious to the existence of libraries, and am trying to envision a language that makes dependency management (upgrading, migrating, etc) much much easier. Who wants to chat about it?


Breaking changes can be isolated per exported declaration.
Type changes can be accompanied by migrations that make them not breaking.

Breaking =
- a type change not accompanied by a migration macro
- a behavior change (not accompanied by a migration) that causes a previous versions test to break

----
