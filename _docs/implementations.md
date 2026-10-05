---
title: Implementations and with
nav_title: Implementations & with
order: 20
part: Effects
summary: The model beneath effect rows — where an effect's implementation comes from, how a named implementation and with choose a different one, and how to store a computation in a data field.
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
implementation the program's entry point binds for `main`'s `{Console}`. A microcontroller layer
ships its own default over a UART, and the same application code runs on it unchanged.

Under the hood, each entry of a row becomes one hidden type parameter of the function, and its value
is the *name* of an implementation. When `main` calls `greet`, which calls `printLine`, that name is
handed down call by call, so every `printLine` in the program is an ordinary, direct call to a known
method. There is no carrier type, no monad and no runtime dictionary lookup: after compilation an
effect operation costs exactly what a function call costs.

## Where an implementation comes from

For every effectful call, the compiler picks the implementation by walking outward from the call,
and stops at the first of these that applies:

1. the nearest enclosing **`with`** for that effect (see below), or **discharging parameter** the
   call sits in — `catch`, `else`, `runStateToPair` and friends supply the implementation of the
   effect they discharge — whichever is nearer;
2. otherwise, the enclosing function's own row — the implementation it **received from its caller**;
3. otherwise, for an effect, nothing — that is the familiar *"performs the effect but does not
   declare it"* error, reported at the call.

At the top, the platform's entry point binds the defaults for `main`'s row, and from there step 2
carries them down. The whole decision is read off declarations, per call, in source order; there is
nothing for the compiler to guess and no ordering it could get wrong.

## Choosing a different implementation: `with`

A **named** implementation is one that is never a default. It can live in any module — a test, an
application, a library — and is only ever used where you bind it with `with`:

```eliot
def greeting(name: String): {Console} Unit = printLine("Hello, " ++ name ++ "!")

implement recordingConsole: Console {
   def printLine(s: String): {Writer[String]} Unit = tell(s ++ ";")
   def readLine: Option[String] = None
}

def transcript: String = runWriterToLog(greeting("Bob") with recordingConsole)
// "Hello, Bob!;"
```

`with` binds a name for its subject: every `Console` call lexically inside `greeting("Bob")` — and,
through step 2, everything `greeting` calls — uses `recordingConsole`. It is infix, binds loosest of
all operators, and reads left to right, so `program with fakeConsole with fakeFileSystem` replaces
two effects and leaves every other one at its default.

A few properties are worth knowing:

- **A clause may perform effects of its own.** `recordingConsole`'s `printLine` declares
  `{Writer[String]}`. That row is charged where the name is bound — here, inside `runWriterToLog`,
  which discharges it. It never appears in `greeting`'s row.
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

The same construct can be written in a parameter's type. Then the function decides the
implementation for whatever computation its caller writes in that slot:

```eliot
def transcriptOf(program: {Console} Unit with recordingConsole): String = runWriterToLog(program)

def greetTest: String = transcriptOf(greeting("Bob"))
```

This is the one way a function can bind calls it cannot see — they were written by its caller — and
it is how a small test helper hides the fake entirely.

### `with` is written almost nowhere

Production code names no implementation. A function declaring `{Console}` receives its console from
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

## Storing a computation in a `data` field

A field may hold an unrun computation. Give it a row, exactly as on a parameter:

```eliot
data Task(label: String, step: {Throw[String]} String)
```

Building a `Task` does **not** run `step`; reading the field does. Two rules make that predictable:

- **A stored computation is bound where it is written.** The implementations its calls use are fixed
  at the construction site, by the declarations in force there. Storing the value, passing it around
  and running it later never changes what it does.
- **Its row is charged where it is read.** `step(task)` (or `task.step`) runs the computation, so the
  reading function must declare or discharge `Throw[String]`, like any other call that may raise:

```eliot
def failing: Task = Task("load", raise("missing file"))

def outcome(task: Task): Either[String, String] = runThrow(step(task))
```

Because the binding was decided at construction, applying `with` to a field read afterwards is an
error, not a rebinding — there is nothing left to bind. Decide the implementation before you store.

## Naming a row

A row you repeat can be named with an ordinary type alias whose body is a row:

```eliot
type Talking[A] = {Console} A

def greet(name: String): Talking[Unit] = printLine("Hello, " ++ name ++ "!")

def announce(name: String): {Log} Talking[Unit] = {
   log("announcing " ++ name)
   greet(name)
}
```

`greet` declares exactly what `{Console} Unit` would, and a named row composes with a written-out
one: `announce` declares both `Log` and `Console`. The alias is an ordinary name — it can be imported,
made private, and shadowed. For now it works in **return position only**; a parameter or field still
spells its row out.

## What deliberately has no spelling

- **A closed row.** A parameter's row says what it *supplies*, not what it forbids, so there is no
  way to write "this argument may perform nothing at all".
- **A negative effect.** Discharge installs a handler around a call, so a discharged effect simply
  never joins the row; there is nothing to subtract.
- **A name for a set of implementations.** `with` binds one at a time.

## The spelling the tooling speaks

Because an effect is a plain ability and an implementation is a name, there is no hidden machinery
for a type to expose. Hover an effectful value in the IDE and you see the signature you wrote; a
diagnostic about effects speaks in rows:

```text
error: This value performs the effect 'Console' but does not declare it;
       add it to its { ... } effect set.
```

Next: what happens when several effects meet —
[Combining and ordering effects]({{ '/docs/combining-effects/' | relative_url }}).
