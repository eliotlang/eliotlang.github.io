---
title: Implementations and with
nav_title: Implementations & with
order: 20
part: Effects
summary: The model beneath uses clauses — where an effect's implementation comes from, how a named implementation and with choose a different one, and what a data field holds instead of a computation.
---

Everything so far worked without knowing what happens underneath. This chapter opens the box. The
model is small: an effect is an ability, an implementation is a **name**, and the compiler writes the
right name into every call before the program is type checked. Nothing is inferred and nothing is
wrapped.
{: .docs-lead}

## An effect is an ability; an implementation is a name

An effect declares operations and no bodies:

```eliot
effect Console {
   def printLine(s: String): Unit
   def readLine: Option[String]
}
```

Something still has to say *how* a line is printed. That is an **implementation** — an ordinary
`implement` block, written in plain Eliot. The JVM layer ships this one:

```eliot
implement Console {
   def printLine(s: String): Unit = printLineInternal(s)
   def readLine: Option[String] = lineOrNone(readLineInternal)
}
```

It has no name, and it sits in the effect's own module, which makes it the **default**: the
implementation the program's entry point binds for `main`'s `uses Console`. A microcontroller layer
ships its own default over a UART, and the same application code runs on it unchanged.

Under the hood, each effect in a `uses` clause becomes one hidden type parameter of the function, and
its value is the *name* of an implementation. When `main` calls `greet`, which calls `printLine`, that name is
handed down call by call, so every `printLine` in the program is an ordinary, direct call to a known
method. There is no carrier type, no monad and no runtime dictionary lookup: after compilation an
effect operation costs exactly what a function call costs.

## Where an implementation comes from

For every effectful call, the compiler picks the implementation by walking outward from the call,
and stops at the first of these that applies:

1. the nearest enclosing **`with`** for that effect (see below);
2. the enclosing function's own `uses` clause — the implementation it **received from its caller**;
3. the **code parameter** the call is written in, when that parameter is given the effect —
   `catch`, `else`, `runStateToPair` and friends give the code they run the implementation of the
   effect they discharge;
4. otherwise, for an effect, nothing — that is the familiar *"performs the effect but does not
   declare it"* error, reported at the call.

At the top, the platform's entry point binds the defaults for `main`'s `uses` clause, and from there
rule 2 carries them down. Implementations are created only there and inside the platform's own
dischargers: a function with a body can pass on what it received, or what a `with` names, but it
cannot conjure an implementation for code it was given. The whole decision is read off declarations, per call, in source order; there is
nothing for the compiler to guess and no ordering it could get wrong.

## Choosing a different implementation: `with`

A **named** implementation is one that is never a default. It can live in any module — a test, an
application, a library — and is only ever used where you bind it with `with`:

```eliot
def greeting(name: String) uses Console: Unit = printLine("Hello, " ++ name ++ "!")

implement recordingConsole: Console {
   def printLine(s: String) uses Writer[String]: Unit = tell(s ++ ";")
   def readLine: Option[String] = None
}

def transcript: String = runWriterToLog(greeting("Bob") with recordingConsole)
// "Hello, Bob!;"
```

`with` binds a name for its subject: every `Console` call lexically inside `greeting("Bob")` — and,
through rule 2, everything `greeting` calls — uses `recordingConsole`. It is infix, binds loosest of
all operators, and reads left to right, so `program with fakeConsole with fakeFileSystem` replaces
two effects and leaves every other one at its default.

A few properties are worth knowing:

- **A clause may perform effects of its own.** `recordingConsole`'s `printLine` declares
  `uses Writer[String]`. That effect is charged where the name is bound — here, inside
  `runWriterToLog`, which discharges it. It never appears in `greeting`'s `uses` clause.
- **A named implementation takes no parameters and captures nothing.** Whatever it needs at runtime
  it asks an effect for, as `recordingConsole` does with `Writer`.
- **It cannot cheat.** User code cannot declare platform natives, so an implementation reaches the
  outside world only through effects its own clauses declare — which are charged and checked like
  any others.
- **It never collides with a default.** Named implementations are never searched, so a test's fake
  may freely overlap the platform's `Console`.

`with` works on an ordinary [ability]({{ '/docs/abilities/' | relative_url }}) just the same — a
named implementation of `Show[Int]` bound with `with` changes how the calls in its subject show an
`Int` — because an effect *is* an ability. The difference is only where the default comes from: an
ability's is found by its type, while an effect's comes from the caller.

### `with` on a parameter

The same construct can be written in a code parameter's `uses` clause, after the effect it binds.
Then the function decides the implementation for whatever code its caller writes in that slot:

```eliot
def transcriptOf(program uses *, Console with recordingConsole: Unit): String = runWriterToLog(program)

def greetTest: String = transcriptOf(greeting("Bob"))
```

This is the one way a function can bind calls it cannot see — they were written by its caller — and
it is how a small test helper hides the fake entirely.

### `with` is written almost nowhere

Production code names no implementation. A function declaring `uses Console` receives its console from
its caller, all the way up to `main`, and that chain is exactly what lets a test substitute one. A
`with` in production code is the same mistake as a hard-coded dependency. Its home is tests and the
odd local reinterpretation.

## Two families of effect

Nothing in the language distinguishes them, but the shipped effects fall into two groups:

- **Control effects** — `Throw`, `Abort`, `State`, `Writer`, `Dep`, `Inf` — have exactly one
  implementation per platform, built on a few private primitives (a non-local exit, a scoped cell, a
  loop). There is nothing to choose with `with`; you *discharge* them instead.
- **Interpretation effects** — `Console`, `Log`, `FileSystem`, `Process`, `Environment`, and your own
  effects — are what `with` is for: the platform ships a default, and a test or an application may
  bind another.

## What a `data` field holds

A field holds a **value**. A pure function is a value, so a field may hold one:

```eliot
data Handler(name: String, run: String => String)

def shout: Handler = Handler("shout", s -> s ++ "!")
```

What a field cannot hold is code that uses effects. There is no `uses` clause on a field, and a lambda
stored in one may use no effect from around it — it would run long after the call that gave it its
effects had returned, with a `catch` or a `runStateToPair` it relied on long gone. So when a program
wants to describe work now and do it later, it stores **data describing the work**, and performs it
where the effects are in scope:

```eliot
data Step = Print(text: String) | Fail(problem: String)

def perform(step: Step) uses Console, Throw[String]: Unit = step match {
   case Print(text) -> printLine(text)
   case Fail(problem) -> raise(problem)
}

def outcome(step: Step) uses Console: Either[String, Unit] = runThrow(perform(step))
```

A `Step` is an ordinary value: it can be built anywhere, kept in a list, compared, and tested without
running anything. Whoever calls `perform` declares the effects, and a test can run the very same steps
against a fake `Console`. On a microcontroller this is what you want anyway: a `Step` is a small
fixed-size record, where a stored closure would be a heap allocation.

## Naming a set of effects

A set of effects you repeat can be named with a type alias. Its body lists the effects in braces
before the result type — the one place effects are still written next to a type, until a `uses`
form for it is settled:

```eliot
type Talking[A] = {Console} A

def greet(name: String): Talking[Unit] = printLine("Hello, " ++ name ++ "!")

def announce(name: String) uses Log: Talking[Unit] = {
   log("announcing " ++ name)
   greet(name)
}
```

`greet` declares exactly what `uses Console` would, and the alias composes with a `uses` clause:
`announce` declares both `Log` and `Console`. The alias is an ordinary name — it can be imported,
made private, and shadowed. It works in **return position only**; a parameter spells its effects out
in its own `uses` clause.

## What deliberately has no spelling

- **A negative effect.** Discharge installs a handler around a call, so a discharged effect simply
  never joins the `uses` clause; there is nothing to subtract.
- **A name for a set of implementations.** `with` binds one at a time.
- **Effectful code kept for later.** Code is called or passed on, never stored; store data instead,
  as above.

(A *closed* parameter — code that may use only what it lists — does have a spelling: leave out the
`*`, as in `body uses Throw[E]: A`. See [When effects run]({{ '/docs/effect-evaluation/' | relative_url }}#closing-a-parameter).)

## The spelling the tooling speaks

Because an effect is a plain ability and an implementation is a name, there is no hidden machinery
for a type to expose. Hover an effectful value in the IDE and you see the signature you wrote; a
diagnostic about effects speaks in `uses` clauses:

```text
error: This value performs the effect 'Console' but does not declare it;
       add it to its `uses` clause.
```

Next: what happens when several effects meet —
[Combining and ordering effects]({{ '/docs/combining-effects/' | relative_url }}).
