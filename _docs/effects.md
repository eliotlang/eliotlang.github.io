---
title: Effects in direct style
nav_title: Effects, direct style
order: 16
part: Effects
summary: What an effect is, how a uses clause declares the effects a function may use, and why effectful code still reads like ordinary straight-line code.
---

Eliot's algebraic effects let you say what a function *may do* — print, fail, read state — as an
unordered set in its signature, while writing the code in ordinary direct style. This is the part of the
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
function's signature lists the effects it may use in a **`uses` clause**, written before the colon:

```eliot
def shout(message: String) uses Console: Unit = printLine(message)
```

`uses Console: Unit` reads: *"produces a `Unit`, and uses the console along the way."*

Three properties make a `uses` clause different from the mechanisms you may be comparing it to:

- **It is a set, not a sequence.** `uses Log, Throw[String]` and `uses Throw[String], Log` say the
  same thing. Nothing about ordering or nesting is fixed by the clause.
- **It sits beside the result type, not around it.** The result type after the colon is the
  **plain** type — `Unit`, `String`, `Config` — never a wrapped `IO[Unit]` or `Future[Config]`.
  Effects never appear inside a type at all, so there is nothing to unwrap, map over, or await.
- **It covers every kind of effect**, not just failure: I/O, errors, state, dependencies, and even
  non-termination all use the same mechanism, so they compose with each other the same way.

An effect is not magic control flow. Each one is an ordinary
[ability]({{ '/docs/abilities/' | relative_url }}) — an interface something implements — declared
with the `effect` keyword:

```eliot
effect Console {
   def printLine(s: String): Unit
   def readLine: Option[String]
}
```

The clause is the compiler's record of which effects a body needs, and an implementation of each is
handed in from outside — by the platform when the program runs, or by a test that wants to fake one.
That is why user code can define new effects with no compiler support.

## The vocabulary is already in scope

The whole `eliot.effect` package is **ambient**: it is auto-imported into every module, so
`printLine`, `raise`, `catch`, `state` and friends need no import line. A local declaration of the
same name silently wins over the ambient one, so a name you want back is always yours to reclaim.

There is no hidden machinery to import either: no monad, no wrapper type, no carrier. An effect is
an ability, and its implementation is plain code.

## Direct style: no plumbing

Inside an effectful function you just *call things*. An effectful call yields its plain value:
`readLine` **is** an `Option[String]` where you write it, and `printLine` takes a plain `String`.
Blocks, arguments and dot chains run in the order you write them, with nothing to thread by hand.

```eliot
def echo uses Console: Unit = printLine(readLine orElse "(no input)")

def greetTwice uses Console: Unit = {
   printLine("Hello!")
   printLine("Hello again!")
}
```

You never write `flatMap`, `await`, `?`, or `<-`. A `val` binds the *result* of an effectful step,
exactly as it binds a pure one:

```eliot
def greetByName uses Console: Unit = {
   printLine("What is your name?")
   val name = readLine orElse "stranger"
   printLine("Hello, " ++ name ++ "!")
}
```

(`readLine` yields an `Option[String]`, which is `None` at the end of input; `orElse` supplies the
default.)

There is nothing to rewrite here. An effect operation is an **ordinary call** to an ordinary
function — the implementation of `printLine` that is in force — so a block runs its steps in order
for the same reason it does in Java or C: evaluation is strict, and a block is a sequence. No
`IO` value is built and later interpreted.

> **Evaluation order is driven by signatures, not by guesswork.** Everything you need to know about
> when an argument runs is written in the declarations you can see: a parameter with no `uses`
> clause takes a value, computed before the call. That is why the next
> chapter, [When effects run]({{ '/docs/effect-evaluation/' | relative_url }}), is about *reading*
> those declarations: once you can, the evaluation order of any expression is something you can see
> rather than infer.
{: .note}

## Effects float up

If your function calls something that may use the console, then your function may use the console.
Effects propagate to callers automatically:

```eliot
def name uses Console: String = readLine orElse "stranger"

def greet uses Console: Unit = printLine(name)
```

`greet` uses `Console` because `name` does, so it declares it too. You pass nothing by hand: an
effect is like a parameter you never spell out. `greet`'s caller hands it a `Console`, and `greet`
hands that same one on to `name`.

## The one rule: used must be declared

A body may perform only the effects its `uses` clause declares. The compiler checks every call in
the body against it:

```eliot
def leaky: Unit = printLine("oops")
```

```text
error: This value performs the effect 'Console' but does not declare it;
       add it to its `uses` clause.
```

Two consequences worth internalising:

- **A signature with no `uses` anywhere is genuinely pure.** Not "pure by convention" — it provably
  performs no effect, because any effect it performed would have to appear in a `uses` clause.
  (The next chapter shows the one other place `uses` can appear: on a parameter.)
- **The check runs both ways.** Declaring `uses Console` and never using it is an error too —
  *"This value declares the effect 'Console' but does not perform it"* — just as an unused
  parameter would be noise. A signature lists exactly what the body does.

The check is per definition and reads only declarations — your signature and the signatures of what
you call — so it never depends on how your function happens to be used elsewhere. An undeclared
effect is an error at the call that performs it; it never merely warns.

## Where effects end

An effect declared in a signature has to be *handled* somewhere. When a function fully handles an
effect inside its body — recovers the failure, supplies the dependency, runs the state from an
initial value — that effect **drops out of its `uses` clause**:

```eliot
def parsePort(config: String) uses Throw[String]: String = raise("no port in configuration")

def port(config: String): String = parsePort(config) catch (err -> "8080")
```

`parsePort` may fail; `port` cannot, and its signature says so with no `uses` at all. That is
**discharge**, and it is how effects end — the clause only ever lists what *escapes*. Every effect has
at least one discharger, and they get their own
[chapter]({{ '/docs/discharging-effects/' | relative_url }}).

## `main` — where effects meet the platform

`main` is an ordinary effectful function; the platform runs whatever its `uses` clause declares:

```eliot
def main uses Console: Unit = printLine("Hello World!")
```

You never say *how* `Console` is performed. The target you compile for — the JVM today, a
microcontroller tomorrow — ships a **default implementation** of each effect it supports, and the
entry point binds those defaults for every effect `main` declares. Below `main`, each function simply
receives the implementation its caller had, so the one decision made at the top reaches every
`printLine` in the program. This is the payoff that motivates the whole design:

- **Business logic stays portable.** A `uses Console, Throw[String]` function names no platform type,
  so it compiles for any target that can provide those effects.
- **Failure handling is visible.** You can see from a signature whether a call can fail, and the
  compiler will not let you forget one.
- **The whole program is analyzable.** Effects reaching `main` are exactly the capabilities the
  program needs — which, on a microcontroller with no operating system to catch mistakes, is the
  difference between a proof and a hope.

## What the rest of this part covers

- **[When effects run]({{ '/docs/effect-evaluation/' | relative_url }})** — evaluation order,
  values versus code, and `uses` on a parameter.
- **[The effect catalogue]({{ '/docs/effect-catalogue/' | relative_url }})** — the shipped effects,
  their operations, and how each is discharged.
- **[Discharging effects]({{ '/docs/discharging-effects/' | relative_url }})** — turning effectful
  code back into plain values.
- **[Implementations and `with`]({{ '/docs/implementations/' | relative_url }})** — the model
  underneath: where an effect's implementation comes from, how to choose a different one, and what
  to store in a `data` field instead of a computation.
- **[Combining and ordering effects]({{ '/docs/combining-effects/' | relative_url }})** — what
  happens when several effects meet.
- **[Testing effects]({{ '/docs/testing-effects/' | relative_url }})** — running effectful logic
  with no I/O at all, and faking an effect without touching the code under test.

Next: [When effects run]({{ '/docs/effect-evaluation/' | relative_url }}).
