---
title: Effects in direct style
nav_title: Effects, direct style
order: 16
part: Effects
summary: What an effect is, how a uses clause declares the effects a function may use, why effectful code still reads like ordinary straight-line code, and where effects begin and end.
---

Eliot's effects let a signature say what a function *may do* — print, fail, read state — while the
body is written in ordinary direct style. This is the part of the language that feels most different,
and most freeing. The whole idea fits in one sentence: **an effect is a parameter you don't spell**.
{: .docs-lead}

This part of the guide builds the picture in layers. This chapter is the first layer: what an effect is,
what declaring one changes about your code, and where effects begin and end. Nothing here needs you to
know how it works underneath — that comes in later chapters, and by then it will look inevitable.

## What an effect is

In most languages, what a function does *besides* returning its result is invisible in its type.
`parseConfig(text)` might read a file, print a warning, throw, or block for a second — the signature
says only that a `String` goes in and a `Config` comes out. You find out by reading the
implementation, and then everything it calls.

An **effect** in Eliot is a named set of operations that code may perform: `Console` has
`printLine` and `readLine`, `Throw[E]` has `raise`, `State[S]` has `state` and `putState`. A
function lists the effects it may use in a **`uses` clause**, written between its parameters and the
colon:

```eliot
def shout(message: String) uses Console: Unit = printLine(message)
```

`uses Console: Unit` reads: *"produces a `Unit`, and uses the console along the way."*

Three properties of the clause are worth fixing in mind from the start:

- **It is a set, not a sequence.** `uses Log, Throw[String]` and `uses Throw[String], Log` say the
  same thing. Nothing about ordering or nesting is fixed by the clause.
- **It sits beside the result type, not around it.** The type after the colon is the **plain**
  type — `Unit`, `String`, `Config` — never a wrapped `IO[Unit]` or `Future[Config]`. Effects never
  appear inside a type, so there is nothing to unwrap, map over, or await.
- **It covers every kind of effect**, not just failure: I/O, errors, state, dependencies, even
  non-termination all use the same mechanism, so they compose with each other the same way.

Where do the operations come from? An effect is declared with the `effect` keyword, and it looks
like an interface — operations with signatures and no bodies:

```eliot
effect Console {
   def printLine(s: String): Unit
   def readLine: Option[String]
}
```

Something else says *how* a line is printed — an **implementation** of the effect. The platform you
compile for ships one for `Console`; a test may write its own. The function declaring `uses Console`
never says which: it only says it needs one. That is the sense in which an effect is a parameter you
don't spell, and it is also why user code can declare new effects with no compiler support.

## The vocabulary is already in scope

The whole `eliot.effect` package is **ambient**: it is auto-imported into every module, so
`printLine`, `raise`, `catch`, `state` and the rest need no import line. A local declaration of the
same name silently wins over the ambient one, so any name is yours to reclaim.

There is no hidden machinery to import either: no monad, no wrapper type. An effect is a declaration
of operations, and an implementation of it is plain code.

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

(`readLine` yields an `Option[String]`, which is `none` at the end of input; `orElse` supplies the
default.)

There is nothing to rewrite here, because an effect operation is an **ordinary call** — to whatever
implementation of `printLine` is in force. A block runs its steps in order for the same reason it
does in Java or C: evaluation is strict, and a block is a sequence. No description of the work is
built up and interpreted later; the work simply happens where it is written.

## Effects float up

If your function calls something that may use the console, then your function may use the console.
Effects propagate to callers automatically:

```eliot
def name uses Console: String = readLine orElse "stranger"

def greet uses Console: Unit = printLine(name)
```

`greet` uses `Console` because `name` does, so it declares it too. You pass nothing by hand: an
effect is a parameter you never spell out. `greet`'s caller hands it a `Console`, and `greet` hands
that same one on to `name` — and on to its own `printLine`.

## The rule: used must be declared

A body may perform only the effects its `uses` clause declares. The compiler checks every call in
the body against the clause:

```eliot
def leaky: Unit = printLine("oops")
```

```text
error: This value performs the effect 'Console' but does not declare it;
       add it to its `uses` clause.
```

Three consequences are worth internalising:

- **A signature with no `uses` anywhere is genuinely pure.** Not "pure by convention" — it provably
  performs no effect, because any effect it performed would have to appear in a clause. And since
  [non-termination]({{ '/docs/totality/' | relative_url }}) is an effect too (`Inf`), such a
  function also provably terminates.
- **The check runs both ways.** Declaring `uses Console` and never using it is an error as well —
  *"This value declares the effect 'Console' but does not perform it"* — just as an unused
  parameter would be noise. A signature lists exactly what the body does.
- **The check reads declarations only.** Your signature, and the signatures of what you call. It
  never depends on how your function happens to be used elsewhere, and an undeclared effect is an
  error at the call that performs it — never a warning, and never a surprise at run time.

## Where effects end

A `uses` clause lists what *escapes* a function. When the function fully handles an effect inside
its body — recovers the failure, supplies the state's initial value, injects the dependency — that
effect **drops out of its clause**:

```eliot
def parsePort(config: String) uses Throw[String]: String = raise("no port in configuration")

def port(config: String): String = parsePort(config) catch (err -> "8080")
```

`parsePort` may fail; `port` cannot, and its signature says so with no `uses` at all. That is
**discharge**, and it is how effects end. You have met it already without the name: a bare `if`
performs `Abort`, and the `else` discharges it, which is why an `if..else` leaves nothing in your
signature ([Branching]({{ '/docs/branching/' | relative_url }})). Every effect has at least one
discharger, and they get their own [chapter]({{ '/docs/discharging-effects/' | relative_url }}).

## `main` — where effects meet the platform

Not every effect can be discharged into a value — printing really has to print. Such effects float
all the way up to `main`, which is an ordinary effectful function:

```eliot
def main uses Console: Unit = printLine("Hello World!")
```

You never say *how* `Console` is performed. The target you compile for — the JVM today, a
microcontroller tomorrow — ships a **default implementation** of each effect it supports, and the
program's entry point binds those defaults for every effect `main` declares. Below `main`, each
function receives the implementation its caller had, so the one decision made at the top reaches
every `printLine` in the program.

This is the payoff that motivates the whole design:

- **Business logic stays portable.** A `uses Console, Throw[String]` function names no platform
  type, so it compiles for any target that can provide those effects.
- **Failure handling is visible.** You can see from a signature whether a call can fail, and the
  compiler will not let you forget to handle it or declare it.
- **The whole program is analyzable.** The effects reaching `main` are exactly the capabilities the
  program needs — which, on a microcontroller with no operating system to catch mistakes, is the
  difference between a proof and a hope.
- **Everything is testable.** Because no function says *which* implementation it uses, a test can
  hand it a different one, without touching the code under test.

> **In one sentence.** A function declares the effects it uses; its caller hands it an implementation
> of each; an operation is an ordinary call to that implementation; and an effect leaves a signature
> either by being discharged inside the body, or by reaching `main`, where the platform performs it.
{: .tip}

## The rest of this part

Each chapter adds one layer to this picture:

1. **[The effect catalogue]({{ '/docs/effect-catalogue/' | relative_url }})** — the effects that
   ship with the language, their operations, and how each one is handled.
2. **[Discharging effects]({{ '/docs/discharging-effects/' | relative_url }})** — turning effectful
   code back into plain values: `catch`, `else`, the `run…` family, and how to write a handler.
3. **[Combining and ordering effects]({{ '/docs/combining-effects/' | relative_url }})** — what
   happens when several effects meet, and why the order you discharge them in matters.
4. **[Values and code]({{ '/docs/effect-evaluation/' | relative_url }})** — exactly *when* an
   effect runs, read off the signature: a parameter takes a value, or it takes code.
5. **[Implementations and `with`]({{ '/docs/implementations/' | relative_url }})** — the model
   underneath: where an implementation comes from, and how to choose a different one.
6. **[Testing effects]({{ '/docs/testing-effects/' | relative_url }})** — running effectful logic
   with no I/O at all, and faking an effect without touching the code under test.

Next: [the effect catalogue]({{ '/docs/effect-catalogue/' | relative_url }}).
