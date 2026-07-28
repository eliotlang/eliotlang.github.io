---
title: Effects in direct style
nav_title: Effects, direct style
order: 16
part: Effects
summary: What an effect is, how an effect row becomes part of a function's type, and why effectful code still reads like ordinary straight-line code.
---

Eliot's algebraic effects let you say what a function *may do* — print, fail, read state — as an
unordered set in its type, while writing the code in ordinary direct style. This is the part of the
language that feels most different, and most freeing.
{: .docs-lead}

This part of the guide builds the picture in pieces. This chapter answers the first two questions:
**what is an effect**, and **what does declaring one change about your code**. Nothing here requires
you to know how it works underneath — that comes later, and by then it will look inevitable.

## What an effect is

In most languages, what a function does *besides* returning its result is invisible in its type.
`parseConfig(text)` might read a file, print a warning, throw, or block for a second — the signature
says only that a `String` goes in and a `Config` comes out. You find out by reading the
implementation, and then by reading everything it calls.

An **effect** in Eliot is a named set of operations that code may perform: `Console` has
`printLine` and `readLine`, `Throw[E]` has `raise`, `State[S]` has `state` and `putState`. A
function's signature lists the effects it may use. That list is called its **effect row**:

```eliot
def shout(message: String): {Console} Unit = printLine(message)
```

`{Console} Unit` reads: *"produces a `Unit`, and may use the console along the way."*

Three properties make a row different from the mechanisms you may be comparing it to:

- **It is a set, not a sequence.** `{Log, Throw[String]}` and `{Throw[String], Log}` are the same
  type. Nothing about ordering or nesting is fixed by the row.
- **It sits beside the value type, not around it.** The result type inside the braces is the
  **plain** type — `Unit`, `String`, `Config` — never a wrapped `IO[Unit]` or `Future[Config]`.
  There is no wrapper type in application code at all, so nothing has to be unwrapped, mapped over,
  or awaited.
- **It covers every kind of effect**, not just failure: I/O, errors, state, dependencies, and even
  non-termination all use the same mechanism, so they compose with each other the same way.

An effect is not magic control flow. Each one is an ordinary
[ability]({{ '/docs/abilities/' | relative_url }}) — an interface a platform implements — and the
row is the compiler's record of which abilities a body needs. That is why user code can define new
effects with no compiler support.

## The vocabulary is already in scope

The whole `eliot.effect` package is **ambient**: it is auto-imported into every module, so
`printLine`, `raise`, `catch`, `state` and friends need no import line. A local declaration of the
same name silently wins over the ambient one, so a name you want back is always yours to reclaim.

Only the machinery underneath the effects — the `eliot.carrier` package — is import-required, and
that is deliberate: application code never needs it. You will see it once, much later, when writing
your own effect-generic library function.

## Direct style: no plumbing

Inside an effectful function you just *call things*. An effectful call yields its plain value:
`readLine` **is** a `String` where you write it. Sequencing through blocks, arguments, and dot
chains is inserted by the compiler.

```eliot
def echo: {Console} Unit = printLine(readLine)

def greetTwice: {Console} Unit = {
   printLine("Hello!")
   printLine("Hello again!")
}
```

You never write `flatMap`, `await`, `?`, or `<-`. A `val` binds the *result* of an effectful step,
exactly as it binds a pure one:

```eliot
def greetByName: {Console} Unit = {
   printLine("What is your name?")
   val name = readLine
   printLine(name)
}
```

The compiler rewrites this into explicit sequencing before type checking — the same code you would
have written by hand in a language with a monadic I/O type. The difference is that you did not have
to, and the resulting program is the same either way.

> **The rewrite is driven by signatures, not by guesswork.** Everything the compiler needs to know
> about how a call is sequenced is written in the declarations it can see. That is why the next
> chapter, [When effects run]({{ '/docs/effect-evaluation/' | relative_url }}), is about *reading*
> those declarations: once you can, the evaluation order of any expression is something you can see
> rather than infer.
{: .note}

## Effects float up

If your function calls something that may use the console, then your function may use the console.
Effects propagate to callers automatically:

```eliot
def name: {Console} String = readLine

def greet: {Console} Unit = printLine(name)
```

`greet` performs `Console` because `name` does. Nothing was passed, injected, or threaded — the row
of a body is simply the union of the rows of what it calls.

## The one rule: used must be declared

A body may perform only the effects its signature declares. The compiler adds up what a body
actually does and checks it against the row:

```eliot
def leaky: Unit = printLine("oops")
```

```text
error: This value performs the effect 'Console' but does not declare it;
       add it to its { ... } effect set.
```

Two consequences worth internalising:

- **A function with no row is genuinely pure.** Not "pure by convention" — it provably performs no
  effect, because any effect it performed would have to appear in its row.
- **A row is a "may", not a "must".** Declaring `{Console}` and never printing is fine. The check is
  one-directional: everything you do must be declared, not the other way around.

This is checked twice, and both checks speak the same language: once per definition, as soon as
your signature and the signatures you call are known, and once more after the whole program is
assembled, on every concrete instantiation. The second check is a fail-safe — an undeclared effect
stops code generation, it never merely warns.

## Where effects end

An effect declared in a signature has to be *handled* somewhere. When a function fully handles an
effect inside its body — recovers the failure, supplies the dependency, runs the state from an
initial value — that effect **drops out of its row**:

```eliot
def parsePort(config: String): {Throw[String]} String = raise("no port in configuration")

def port(config: String): String = parsePort(config) catch (err -> "8080")
```

`parsePort` may fail; `port` cannot, and its signature says so with no row at all. That is
**discharge**, and it is how effects end — the row only ever lists what *escapes*. Every effect has
at least one discharger, and they get their own
[chapter]({{ '/docs/discharging-effects/' | relative_url }}).

## `main` — where effects meet the platform

`main` is an ordinary effectful function; the platform runs whatever its row declares:

```eliot
def main: {Console} Unit = printLine("Hello World!")
```

You never say *how* `Console` is performed. The target you compile for — the JVM today, a
microcontroller tomorrow — supplies that when it runs `main`. This is the payoff that motivates the
whole design:

- **Business logic stays portable.** A `{Console, Throw[String]}` function names no platform type,
  so it compiles for any target that can provide those effects.
- **Failure handling is visible.** You can see from a signature whether a call can fail, and the
  compiler will not let you forget one.
- **The whole program is analyzable.** Effects reaching `main` are exactly the capabilities the
  program needs — which, on a microcontroller with no operating system to catch mistakes, is the
  difference between a proof and a hope.

## What the rest of this part covers

- **[When effects run]({{ '/docs/effect-evaluation/' | relative_url }})** — evaluation order, and
  the one rule that makes it readable from a signature.
- **[The effect catalogue]({{ '/docs/effect-catalogue/' | relative_url }})** — the shipped effects,
  their operations, and how each is discharged.
- **[Discharging effects]({{ '/docs/discharging-effects/' | relative_url }})** — turning effectful
  code back into plain values.
- **[Carriers and pinned rows]({{ '/docs/carriers/' | relative_url }})** — the model underneath,
  and how to store a computation in a `data` field.
- **[Combining and ordering effects]({{ '/docs/combining-effects/' | relative_url }})** — what
  happens when several effects meet.
- **[Testing effects]({{ '/docs/testing-effects/' | relative_url }})** — running effectful logic
  with no I/O at all.

Next: [When effects run]({{ '/docs/effect-evaluation/' | relative_url }}).
