---
title: Effects in direct style
nav_title: Effects, direct style
order: 16
part: Effects
summary: What an effect is, how a uses clause says what a function's caller must hand it, why effectful code still reads like ordinary straight-line code, and where effects begin and end.
---

Eliot's effects let a signature say what a function *may do* — print, fail, read state — while the
body is written in ordinary direct style. The whole idea fits in one sentence: **an effect is a
parameter you don't spell.** A function lists what its caller must hand it; the compiler does the
handing, all the way down from `main`, and checks every step.
{: .docs-lead}

This part of the guide builds the picture in layers. This chapter is the first: what an effect is,
what declaring one changes about your code, and where effects begin and end. If you have used
dependency injection, you already know most of it — Eliot makes the compiler do it, and check it.

## What an effect is

In most languages, what a function does *besides* returning its result is invisible in its type.
`parseConfig(text)` might read a file, print a warning, throw, or block for a second — the signature
says only that a `String` goes in and a `Config` comes out. You find out by reading the
implementation, and then everything it calls.

An **effect** in Eliot is a named set of operations that code may perform: `Console` has
`printLine` and `readLine`, `Throw[E]` has `raise`, `State[S]` has `state` and `putState`. It is
declared with the `effect` keyword, and it looks like an interface — operations with signatures and
no bodies:

```eliot
effect Console {
   def printLine(s: String): Unit
   def readLine: Option[String]
}
```

Something else says *how* a line is printed — an **implementation** of the effect. The platform you
compile for ships one for `Console`; a test writes its own. A function that wants to print lists the
effect in a **`uses` clause**, written between its parameters and the colon:

```eliot
def shout(message: String) uses Console: Unit = printLine(message)
```

`uses Console: Unit` reads: *"produces a `Unit`, and needs a console to do it."*

## An effect is a parameter you don't spell

`uses Console` means what an extra parameter would: **whoever calls `shout` hands it a `Console`
implementation**, and `printLine` inside it is a call to that implementation. Written by hand, in a
language without effects, `shout` would look like this:

```java
void shout(Console console, String message) { console.printLine(message); }
```

The difference is that in Eliot you never spell that parameter, never pass it, and never name the
implementation. The compiler adds the parameter, passes it at every call, and picks the one each
operation uses: **the nearest implementation in scope where the operation is written**. Inside
`shout` that is the console `shout` was handed.

Three properties of the clause are worth fixing in mind from the start:

- **It is a set, not a sequence.** `uses Log, Throw[String]` and `uses Throw[String], Log` say the
  same thing. Nothing about ordering or nesting is fixed by the clause.
- **It sits beside the result type, not around it.** The type after the colon is the **plain**
  type — `Unit`, `String`, `Config` — never a wrapped `IO[Unit]` or `Future[Config]`. Effects never
  appear inside a type, so there is nothing to unwrap, map over, or await.
- **It covers every kind of effect**, not just I/O: failure, state, dependencies, even
  non-termination are all effects, handed down the same way, so they compose with each other the
  same way.

And because an implementation is ordinary Eliot code, you can declare effects of your own with no
compiler support.

## Why it is called an effect

Mechanically, this is **dependency injection done by the compiler**: a `uses` clause is a list of
dependencies, checked statically and passed along every call. It is called an *effect* system
because of one convention every platform keeps: anything that reaches the world — printing, reading
a file, starting a process, looping forever — is offered to programs **only** as an operation of an
effect. A program has no other way to call into the platform, so whatever it does besides computing
comes from an implementation it was handed, and being handed one is written `uses`. That is what
lets a missing `uses` mean *pure*.

The reverse does not hold: an effect need not touch the world. `Throw`, `Abort` and `State` do
nothing outside the program, and that is exactly why a function can supply one itself and hand back
a plain value, as [Where effects end](#where-effects-end) shows.

## The vocabulary is already in scope

The whole `eliot.effect` package is **ambient**: it is auto-imported into every module, so
`printLine`, `raise`, `catch`, `state` and the rest need no import line. A local declaration of the
same name silently wins over the ambient one, so any name is yours to reclaim.

There is no hidden machinery to import either: no monad, no wrapper type, no runtime library. An
effect is a declaration of operations, and an implementation of it is plain code.

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

There is nothing to rewrite here, because an effect operation is an **ordinary call** — a method
call on the implementation the function was handed. A block runs its steps in order for the same
reason it does in Java or C: evaluation is strict, and a block is a sequence. No description of the
work is built up and interpreted later; the work simply happens where it is written.

## Passing it on

If your function calls something that needs a console, your function needs one too, so it declares
the effect — and the console it was handed is the one it passes on:

```eliot
def name uses Console: String = readLine orElse "stranger"

def greet uses Console: Unit = printLine(name)
```

`greet`'s caller hands `greet` a console; `greet` hands that same console to `name`, and uses it for
its own `printLine`. You wrote none of that passing. Declaring the effect is the whole of it, and
it is how one decision made at the top reaches every `printLine` in the program.

## The rule: used must be declared

A function can only pass on what it was handed, so a body may perform only the effects its `uses`
clause declares. The compiler checks every call against the clause:

```eliot
def leaky: Unit = printLine("oops")
```

```text
error: This value performs the effect 'Console' but does not declare it; add it to its `uses` clause.
```

Three consequences are worth internalising:

- **A function with no `uses` before its result type is genuinely pure.** Not "pure by convention":
  it is handed nothing, so it has nothing to print with, fail with, or loop with. And since
  [non-termination]({{ '/docs/totality/' | relative_url }}) is an effect too (`Inf`), such a
  function also provably terminates.
- **The check runs both ways.** Declaring `uses Console` and never using it is an error as well —
  *"This value declares the effect 'Console' but does not perform it"* — just as an unused
  parameter would be noise every caller has to supply. A signature lists exactly what the body does.
- **The check reads declarations only.** Your signature, and the signatures of what you call. It
  never depends on how your function happens to be used elsewhere, and an undeclared effect is an
  error at the call that performs it — never a warning, and never a surprise at run time.

## Where effects end

A `uses` clause lists what a function needs *from its caller*. When the function supplies an
effect itself — it recovers the failure, supplies the state's initial value, injects the
dependency — its caller has nothing to hand it, and the effect **drops out of its clause**:

```eliot
def parsePort(config: String) uses Throw[String]: String = raise("no port in configuration")

def port(config: String): String = parsePort(config) catch (err -> "8080")
```

`parsePort` needs a way to fail; `catch` hands it one — an implementation of `Throw[String]` whose
`raise` lands in the handler — so `port` needs nothing, and its signature says so with no `uses` at
all. That is **discharge**, and it is how effects end. You have met it already without the name: a
bare `if` performs `Abort`, and the `else` discharges it, which is why an `if..else` leaves nothing
in your signature ([Branching]({{ '/docs/branching/' | relative_url }})). Every control effect —
failure, state, dependencies — has at least one discharger, and they get their own
[chapter]({{ '/docs/discharging-effects/' | relative_url }}).

## `main` — where the implementations come from

Not every effect can be discharged into a value — printing really has to print. Such effects are
passed all the way up to `main`, which is an ordinary effectful function:

```eliot
def main uses Console: Unit = printLine("Hello World!")
```

Someone has to hand `main` its console. That is the program's **entry point**, which the compiler
generates for the platform you build for. It is one line of ordinary Eliot, and for the program
above, in a module named `HelloWorld`, it reads:

```eliot
def main: Unit = HelloWorld::main with eliot.effect.Console::standardConsole
```

`standardConsole` is the platform's implementation of `Console` — on the JVM it prints to standard
output, on a microcontroller it would write to a UART — and
[`with`]({{ '/docs/implementations/' | relative_url }}) hands an implementation to the code on its
left. The entry point has one `with` for every effect `main` declares, and from there each function
passes on what it was handed.

So only effects the platform has a standard implementation of may reach `main`: the ones it
*performs* — `Console`, `Log`, `FileSystem`, `Process`, `Environment` — and `Inf`, which marks a
program meant to run forever. A failure, a piece of state or a dependency has no standard
implementation, so one that reaches `main` is a **compile error**, not a crash at run time:

```eliot
def main uses Console, Abort: Unit = printLine(if(false, "x"))
```

```text
error: 'main' uses the effect 'Abort', which the platform has no standard implementation of.
  |  Handle it inside 'main': discharge it, or bind an implementation with `with`.
```

This is the payoff that motivates the whole design:

- **Business logic stays portable.** A `uses Console, Throw[String]` function names no platform
  type, so it compiles for any target that can provide those effects.
- **Failure handling is visible.** You can see from a signature whether a call can fail, and the
  compiler will not let you forget to handle it or declare it.
- **The whole program is analyzable.** The effects reaching `main` are exactly the capabilities the
  program needs — which, on a microcontroller with no operating system to catch mistakes, is the
  difference between a proof and a hope.
- **Everything is testable.** No function says *which* implementation it uses, so a test can hand it
  a different one without touching the code under test.
- **It costs nothing extra.** An operation is a direct call to a known method, and an implementation
  with nothing to carry — like `standardConsole` — is not even passed at run time.

> **In one sentence.** A `uses` clause lists the implementations a function's caller must hand it;
> the compiler passes them down every call and checks that each operation has one; and an effect
> leaves a signature either because a discharger inside the body supplies it, or because it reaches
> `main`, where the platform supplies it.
{: .tip}

## The rest of this part

Each chapter adds one layer to this picture:

1. **[The effect catalogue]({{ '/docs/effect-catalogue/' | relative_url }})** — the effects that
   ship with the language, their operations, and how each one is handled.
2. **[Discharging effects]({{ '/docs/discharging-effects/' | relative_url }})** — turning effectful
   code back into plain values: `catch`, `else`, the `run…` family, and how to write a discharger.
3. **[Combining and ordering effects]({{ '/docs/combining-effects/' | relative_url }})** — what
   happens when several effects meet, and why the order you discharge them in matters.
4. **[Values and code]({{ '/docs/effect-evaluation/' | relative_url }})** — exactly *when* an
   effect runs, read off the signature: a parameter takes a value, or it takes code.
5. **[Implementations and `with`]({{ '/docs/implementations/' | relative_url }})** — writing an
   implementation, handing one over with `with`, and how the compiler picks the one an operation uses.
6. **[Testing effects]({{ '/docs/testing-effects/' | relative_url }})** — running effectful logic
   with no I/O at all, and faking an effect without touching the code under test.

Next: [the effect catalogue]({{ '/docs/effect-catalogue/' | relative_url }}).
