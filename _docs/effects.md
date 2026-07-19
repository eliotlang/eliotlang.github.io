---
title: Effects in direct style
nav_title: Effects, direct style
order: 16
part: Effects
summary: Effect rows and direct style for everyday code, storing effectful values in data with pinned rows, and the carrier model underneath.
---

Eliot's algebraic effects let you say what a function *may do* — print, fail, read state — as an
unordered set in its type, while writing the code in ordinary direct style. This is the part of the
language that feels most different, and most freeing.
{: .docs-lead}

## An effect is part of the type

A function that does something beyond computing its result says so in its signature, in braces
before the value type:

```eliot
import eliot.effect.Console

def shout(message: String): {Console} Unit = printLine(message)
```

`{Console} Unit` reads "produces a `Unit`, and may use the console along the way". The braces hold
an **effect row** — a *set* of effects, so a function that logs and may fail is
`{Log, Throw[String]} Configuration`. Two things to notice right away:

- The value type inside the row is the **plain** type — `Unit`, `String`, `Configuration` — never a
  wrapped `IO[Unit]`. There is no `IO` in application code at all.
- The row is **unordered**: `{Log, Throw[String]}` and `{Throw[String], Log}` are the same type.

Effects are imported from `eliot.effect` — they are not ambient, so a file says which ones it talks
about.

## Direct style: no plumbing

Inside an effectful function you just *call things*. An effectful call yields its plain value —
`readLine` is a `String` where you use it — and sequencing through blocks, arguments, and dot chains
is inserted by the compiler. You never write `flatMap`, `await`, or `<-`:

```eliot
import eliot.effect.Console

def echo: {Console} Unit = printLine(readLine)

def greetTwice: {Console} Unit = {
   printLine("Hello!")
   printLine("Hello again!")
}
```

## The one rule: used must be declared

A body may perform only the effects its signature declares. Effects *float up*: calling
`{Console}` code makes *your* function `{Console}` too, and the compiler checks the sum. A
function declared without a row is **pure**, and performing an effect in it is a compile error
("performs the effect 'Console' but does not declare it"). Declaring an effect you don't use is
fine — a row is a "may", not a "must".

And when a function fully *handles* an effect inside its body — recovers the failure, supplies the
dependency — that effect drops out of its row automatically; that's the subject of
[Discharging effects]({{ '/docs/discharging-effects/' | relative_url }}).

## Failing, recovering — a first discharge

`Throw[E]` is the typed-error effect: `raise(err)` stops the computation with an error value.

```eliot
import eliot.effect.Throw

def parsePort(config: String): {Throw[String]} Port = raise("no port in configuration")
```

The caller can let the effect keep floating up — or **discharge** it, handling the failure so
`Throw` disappears from its own row:

```eliot
def port(config: String): Port = parsePort(config) catch (err -> defaultPort)
```

`catch` reads like an exception handler; `runThrow` instead materialises the outcome as data,
turning a `{Throw[E]} A` computation into an `Either[E, A]`. Every effect has such dischargers —
`else` for `Abort`, `runStateToPair` for `State`, `provide` for `Dep` — see the
[effect catalogue]({{ '/docs/effect-catalogue/' | relative_url }}).

> **A discharger wraps the computation expression** — pass the effectful call to it *directly*, as
> in `parsePort(config) catch (…)`. Don't bind the call to a `val` first and discharge the binder:
> the `val` already sequenced the effect away, and the discharger will complain it got a plain
> value.
{: .warn}

## `main` — where effects meet the platform

`main` is an ordinary effectful function; the platform runs whatever its row declares:

```eliot
import eliot.effect.Console

def main: {Console} Unit = printLine("Hello World!")
```

You never say *how* `Console` is performed — the target you compile for (the JVM today, a
microcontroller tomorrow) supplies that when it runs `main`. This is also why business logic stays
portable and testable: the same `{Console, Throw[String]}` function can be run by the platform, or
handled purely in a test.

## Storing effectful values: `data` and pinned rows

So far every row sat on a *function*. Now suppose you want to **store** an effectful computation in
a data type — a test case that runs later, a validation to apply on demand:

```eliot
data TestCase(name: String, body: {Throw[AssertionError]} Unit)
// error: A stored effect row must be pinned to a base carrier, e.g. `{Throw[Error] | Id} String`.
```

The compiler refuses, and the reason is worth understanding: a row on a function leaves *how the
effects run* to each caller, but a stored value cannot keep that question open — it must commit to
one concrete representation the field can hold. You commit by **pinning** the row: naming a base
after `|`:

```eliot
import eliot.effect.Throw
import eliot.lang.Id

data AssertionError(message: String)

data TestCase(name: String, body: {Throw[AssertionError] | Id} Unit)
```

`Id` is the *identity* base: "nothing else". A `{Throw[AssertionError] | Id} Unit` is a stored
computation that can raise an `AssertionError` and do **nothing else whatsoever** — it provably
cannot print, read, or loop forever. Building one is ordinary direct style; consuming one uses the
ordinary dischargers:

```eliot
def passing: TestCase = TestCase("does nothing", unit)
def failing: TestCase = TestCase("always fails", raise(AssertionError("nope")))

def outcome(tc: TestCase): Either[AssertionError, Unit] = runId(runThrow(body(tc)))
```

The rules for rows in `data` fields:

- **A stored row must be pinned.** An open row in a field is a compile error (the one you saw
  above).
- **Pin with `| Id`** when the stored effects are the pure control effects — `Abort`, `Throw[E]`,
  `State[S]`, `Dep[X]`. The platform effects (`Console`, `Log`) cannot be stored this way: they
  have no pure meaning, so handle them *before* the value is stored.
- **Order matters once you pin** — see the next section.
- The data type itself stays completely ordinary — `TestCase` is not generic, and nothing about
  carriers leaks into the code that uses it.

## Under the hood: carriers

You can use everything above without this section. But the model beneath is small, and knowing it
turns the pinned-row rules from decree into consequence.

Every effectful computation runs on a **carrier** — the concrete type that gives its effects
meaning. Each effect is an [ability]({{ '/docs/abilities/' | relative_url }}) *over the carrier*:
on the JVM, `main`'s carrier is the platform's `IO`, whose instances perform `Console` for real; in
a test, the same code can run on a pure carrier that performs nothing. The pure control effects
each come with a canonical carrier *layer* — `Throw[E]` with a layer that produces
`Either[E, A]`, `State[S]` with a state-threading layer — and layers stack over a base.

The two row forms are two answers to "which carrier?":

- An **open row** — `{Throw[E]} A` — leaves the carrier to the caller. Each call site picks
  (usually invisibly, by unification), which is exactly what you want on a function.
- A **pinned row** — `{Throw[E] | Id} A` — *is* the carrier, spelled in effect vocabulary: the
  canonical stack of the listed effects' layers over the named base. It is a concrete type like any
  other.

So the stored-row rule is not an extra restriction — it's the observation that a field needs a
type, and an open row deliberately isn't one yet.

**Order matters when you pin.** The entries are the stack, leftmost outermost, and dischargers peel
from the outside in — so the written order *is* the discharge order, and for effects that don't
commute it decides real behaviour:

```eliot
{Throw[E], State[S] | Id} A   // discharge Throw first: a raise discards the pending state
{State[S], Throw[E] | Id} A   // discharge State first: the state survives even a raise
```

These are two different types; the choice is yours and visible in the source. (Open rows stay
unordered — order only exists once you pin.)

Two things can *not* appear left of a `|`, both by construction: the platform effects
(`Console`, `Log` — they have no canonical pure layer, which is exactly why a stored `| Id` value
can't do I/O), and negative members (`{-Abort | G}` is rejected — discharging is something a
*function* does, not a shape a type has).

One more payoff: this is the spelling the tooling speaks. Hovering an effectful value in the IDE
shows its concrete type *as* a pinned row — `{Throw[String] | IO} String` — so the type you read
is the type you could have written.

## Advanced: generic programming against effects

Library code sometimes needs to work *with* the machinery the sections above let you ignore. Three
idioms cover nearly all of it.

**Take an effectful callback.** A row is a type, usable in any type position — including an arrow
codomain inside a parameter. All rows in one signature share one carrier, so a combinator's
callback effects automatically become the combinator's own:

```eliot
def foreach[A](action: A => {Effect} Unit, list: List[A]): {Effect} Unit
```

`{Effect}` (just the base machinery ability) is the minimal "whatever effects the caller's action
performs" row — `foreach` is exactly as effectful as the `action` it is given.

**Pin over a generic base.** A discharger consumes one layer and leaves the rest, whatever they
are. Its input is a pinned row over a *generic* base `G` — the same `|` syntax, one level up —
and its output row carries a **negative** member (`-E`, "this function *discharges* `E`"), which is
what lets callers drop `E` from their own accounting:

```eliot
def runThrow[E, G[_], A](obj: {Throw[E] | G} A): {-Throw[E]} G[Either[E, A]]

def catch[E, G[_] ~ Effect, A](computation: {Throw[E] | G} A, onError: E => A): {-Throw[E]} G[A] =
   map(e -> foldEither(e, onError, a -> a), runThrow(computation))
```

That is the stdlib's actual `catch` — notice it is ordinary Eliot, written entirely in row syntax:
even generic programming against effects never names a carrier type. Your own handlers usually
don't need the `{-E}` annotation either: when an effect enters through a parameter and demonstrably
does not survive your body, the compiler infers the discharge.

**One boundary rule.** A handler whose effectful input arrives as a carrier-typed *parameter*
(like `computation` above) must return a carrier-headed type — `G[A]`, never a bare `A`. That
carrier belongs to your caller; only they can take it to a pure boundary.

Finally, the payoff of keeping logic generic: any `{Abort, Throw[E], State[S], Dep[X]}` function
can be run on a **pure carrier** — discharge everything, pin what remains over `Id`, and assert on
plain data. That is the subject of
[Testing effects]({{ '/docs/testing-effects/' | relative_url }}).

Next: the shipped effects one by one — operations and dischargers — in the
[effect catalogue]({{ '/docs/effect-catalogue/' | relative_url }}).
