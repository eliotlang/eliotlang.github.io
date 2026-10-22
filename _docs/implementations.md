---
title: Implementations and with
nav_title: Implementations & with
order: 25
part: Effects
summary: Writing an effect's implementation, handing it over with with, how the compiler picks the implementation each operation uses, implementations with parameters and effects of their own, what a data field holds instead of a computation, and how to name a set of effects.
---

Everything so far worked without writing an implementation. This chapter does. The model is small:
an implementation is a **named value** of the effect, `with` hands one to the code on its left, and
every operation uses the nearest one in scope whose type matches. Nothing is inferred and nothing is
wrapped.
{: .docs-lead}

## An implementation is a named value

An effect declares operations and no bodies:

```eliot
effect Console {
   def printLine(s: String): Unit
   def readLine: Option[String]
}
```

An **implementation** gives them bodies. It is an `implement` block with a **name**, written in
plain Eliot. The JVM layer ships this one:

```eliot
implement standardConsole: Console {
   def printLine(s: String): Unit = printLineInternal(s)
   def readLine: Option[String] = lineOrNone(readLineInternal)
}
```

`standardConsole` is a value, like any other named value — and handing it over is what the
program's [entry point]({{ '/docs/effects/' | relative_url }}#main--where-the-implementations-come-from)
does for `main`. A microcontroller layer would ship its own `standardConsole` over a UART, and the
same application code runs on it unchanged. (The base library declares
`implement standardConsole: Console` with no body; each platform supplies the body, the way
[layers]({{ '/docs/layers/' | relative_url }}) supply every platform-specific definition.)

An effect is an [ability]({{ '/docs/abilities/' | relative_url }}) — an interface with
implementations — and an operation call is an ordinary call to the implementation's method. What
differs is how the implementation is found:

- An **ability**'s is found **globally, by type**: `show(42)` finds the one `Show[Int]` there is,
  written in the ability's module or the type's. It has no name, and it is never passed around.
- An **effect**'s is **passed down, like a dependency**: each function receives it from its caller.
  So it is always named, may live in any module, and is never searched for. There can be any number
  of `Console` implementations in one program without conflict.

The compiler holds you to the difference: an unnamed `implement` of an effect is an error (*"An
implementation of the effect 'Console' must be named, since an effect has no default"*), and so is a
named one of an ability.

## Handing one over: `with`

A function declaring `uses Console` uses whichever console its caller hands it. `with` is how you
hand it one:

```eliot
def greeting(name: String) uses Console: Unit = printLine("Hello, " ++ name ++ "!")

implement recordingConsole: Console {
   def printLine(s: String) uses Writer[String]: Unit = tell(s ++ ";")
   def readLine: Option[String] = none
}

def transcript: String = runWriterToLog(greeting("Bob") with recordingConsole)
// "Hello, Bob!;"
```

`with` puts an implementation in scope for its subject: the call `greeting("Bob")` is handed
`recordingConsole`, and passes it on to everything it calls. It is infix, binds loosest of all
operators, and reads left to right, so `program with fakeConsole with fakeFileSystem` hands over two
implementations and leaves every other effect as it was.

A `with` that nothing in its subject takes is an error, never a silent no-op — the likeliest cause is
a `with` written in the wrong place:

```eliot
implement silentConsole: Console {
   def printLine(s: String): Unit = unit
   def readLine: Option[String] = none
}

def answer: Int = 42

def wasted: Int = answer with silentConsole
```

```text
error: This `with` binds nothing: no use of 'Console' in its subject escapes into it.
  |  A `with` binds what its subject performs and does not discharge itself; remove it, or move it to
  |  where 'Console' is performed.
```

## Which implementation an operation uses

One rule decides it, for every operation and every call to a function with a `uses` clause: **the
nearest implementation in scope where the call is written, whose type matches.** In scope, from
nearest to furthest, are:

1. the implementation of each enclosing **`with`**, innermost first;
2. the implementations handed to the **code** the call is written in — `catch` hands its
   computation a `Throw[E]`, `runStateToPair` a `State[S]` (see
   [Values and code]({{ '/docs/effect-evaluation/' | relative_url }}));
3. the implementations the enclosing function was handed through its own **`uses` clause**.

That is ordinary lexical scope, the same rule that finds a variable — with the type deciding which of
the visible implementations a use takes. `Throw[NetError]` and `Throw[ParseError]` in one clause are
two implementations, and each `raise` takes the one whose error type it raises. A type alias makes no
difference: under `type Message = String`, a `Throw[Message]` answers a `Throw[String]`.

When no implementation in scope matches, the error says what *is* in scope. The compiler calls an
implementation, as code holds it, a **handle**:

```eliot
def f uses Throw[String]: Int = raise(1)
```

```text
error: No handle in scope here answers 'Throw[Int]'.
  |  In scope: Throw[String].
```

Two equally near implementations that both match are an error too; there is no syntax for choosing
between them, and the fix is to give them distinct types. Nothing here is inferred: every decision is
a lookup in the scope you can see.

## Implementations with parameters

An implementation may take parameters, written between its name and its effect. A `with` supplies
them:

```eliot
effect Terminal {
   def write(line: String): Unit
   def read: String
}

def greet uses Terminal: Unit = {
   val name = read
   write("Hello, " ++ name ++ "!")
}

implement scripted(answer: String): Terminal {
   def write(line: String) uses Writer[String]: Unit = tell(line ++ ";")
   def read: String = answer
}

def bob: String = runWriterToLog(greet with scripted("Bob"))
// "Hello, Bob!;"
```

The arguments are ordinary values, computed where the `with` is written. They are the
implementation's configuration: one `scripted` serves every answer a test wants.

## Implementations that use other effects

`recordingConsole` and `scripted` record what they print through `Writer[String]`: their `printLine`
and `write` declare `uses Writer[String]`. Such an effect is taken **where the `with` is written** —
from the scope around the `with`, by the same rule as any other use. In `transcript` above that is
the `Writer` that `runWriterToLog` hands its computation, which is why the transcript lands there. It
never appears in `greeting`'s clause: `greeting` only asked for a console, and how that console does
its job is the console's business.

If you know dependency injection, this is constructor injection: the implementation's own
dependencies are supplied when it is bound, not by the code it serves.

The one exception is an effect the operation's *own* declaration lists. `FileSystem`'s
`readFile(path: Path) uses Throw[IoError]` declares its failure, so every caller of `readFile` hands
it a `Throw[IoError]`, and an implementation's `readFile` uses that one.

Two properties follow:

- **An implementation cannot cheat.** User code cannot declare platform natives, so an implementation
  reaches the outside world only through effects its own clauses declare — which are taken and
  checked where it is bound, like any others.
- **It never collides with another.** Implementations are never searched for, so a test's fake may
  freely sit beside the platform's `standardConsole`, even in the same module.

## `with` around a run of code

A function taking code can choose the implementation that code is handed, by writing `with` where it
runs the code:

```eliot
def transcriptOf(program uses *, Console: Unit) uses *: String = runWriterToLog(program with recordingConsole)

def greetTest: String = transcriptOf(greeting("Bob"))
```

`transcriptOf`'s caller writes nothing: `program` is run with `recordingConsole` for its console.
This is how a test helper hides a fake entirely. The implementation's own effect — `Writer[String]`
— is taken from where the `with` is written, here inside `runWriterToLog`.

The effect has to be **listed** on the parameter. An effect the code uses only through the `*` was
handed over where the code was written, and no `with` in the callee can reach it:

```eliot
def transcriptOf(program uses *: Unit) uses *: String = runWriterToLog(program with recordingConsole)
```

```text
error: This `with` binds nothing: 'program' is code its caller wrote, and its use of 'Console' was
       bound where it was written.
  |  To handle 'Console' for 'program', list it in its `uses` clause (`program uses *, Console: …`); a
  |  `with` around its runs then binds it.
```

A `with` around a run counts as
[handling the effect]({{ '/docs/discharging-effects/' | relative_url }}#handle-it-or-declare-it). The
code is compiled once, against the parameter's declaration, so every run of one parameter must be
handed the same implementation — *"This run of the code is handed another implementation than
another run of it"* otherwise. And `with` is only ever written in a body, around an expression: a
parameter's or a field's clause has no `with`.

### Dischargers are written this way

There is nothing more to a discharger. The JVM layer's `runThrow` makes a fresh exit point with a
platform primitive, and hands its code the implementation of `Throw[E]` that leaves through it — with
an ordinary `with`:

```eliot
implement[E] escaping(frame: ThrowFrame[E]): Throw[E] {
   def raise[A](err: E): A = exitInternal(frame, err)
}

def runThrow[E, A](obj uses *, Throw[E]: A) uses *: Either[E, A] =
   escapeInternal((frame: ThrowFrame[E]) -> obj with escaping(frame), (err: E) -> Left(err), a -> Right(a))
```

`escapeInternal`, `exitInternal` and the frame type are private to the platform, and so are the other
two primitives the control effects are built on — a cell scoped to one call, and a loop. Every other
discharger — `catch`, `else`, your own `orZero` — just passes its code on to one of these.

## `with` is written almost nowhere

Production code names no implementation. A function declaring `uses Console` receives its console
from its caller, all the way up to `main`, and that chain is exactly what lets a test substitute one.
A `with` in production code is the same mistake as a hard-coded dependency. Its home is the top of a
program (an effect of your own, which has no standard implementation for the entry point to hand
in), dischargers, and tests.

## What it costs

An operation is a direct call to a known method: the compiler generates the code for each
implementation type it is used with, so there is no lookup at run time. And an implementation is
passed only if it holds something. `standardConsole` holds nothing, so it is not passed at all — a
Hello World's `main` takes no parameter and calls the console's `printLine` directly. One that holds
a single thing, like `escaping`'s exit point, is passed as that thing; only one holding several is
passed as a small record.

## What a `data` field holds

A field holds a **value**. A pure function is a value, so a field may hold one:

```eliot
data Handler(name: String, run: String => String)

def shout: Handler = Handler("shout", s -> s ++ "!")
```

What a field cannot hold is code that uses effects. There is no `uses` clause on a field, and a
lambda stored in one may use no effect from around it — it would run long after the call that handed
it its implementations had returned, with the `catch` or the `runStateToPair` it relied on long gone.
So when a program wants to describe work now and do it later, it stores **data describing the work**,
and performs it where the effects are in scope:

```eliot
data Step = Print(text: String) | Fail(problem: String)

def perform(step: Step) uses Console, Throw[String]: Unit = step match {
   case Print(text) -> printLine(text)
   case Fail(problem) -> raise(problem)
}

def outcome(step: Step) uses Console: Either[String, Unit] = runThrow(perform(step))
```

A `Step` is an ordinary value: it can be built anywhere, kept in a list, compared, and tested without
running anything. Whoever calls `perform` declares the effects, and a test can run the very same
steps against a fake `Console`. On a microcontroller this is what you want anyway: a `Step` is a
small fixed-size record, where a stored closure would be a heap allocation.

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
`announce` declares both `Log` and `Console`. The alias is an ordinary name — it can be imported and
shadowed like any other declaration. It works in **return position only**; a parameter spells its
effects out in its own `uses` clause.

## What deliberately has no spelling

- **A negative effect.** A discharger supplies an effect inside a call, so a discharged effect simply
  never joins the `uses` clause; there is nothing to subtract.
- **A `with` on a parameter or a field.** An implementation is handed over in one place: around an
  expression, in a body.
- **A name for a set of implementations.** `with` hands over one at a time.
- **Effectful code kept for later.** Code is called or passed on, never stored; store data instead,
  as above.
- **An effect inside a type.** `A => B` is a function type and nothing more; what a function value
  may do is said by the parameter it is passed to, never by its type.

(A *closed* parameter — code that may use only what it lists — does have a spelling: leave out the
`*`, as in `body uses Throw[E]: A`. See
[Values and code]({{ '/docs/effect-evaluation/' | relative_url }}#closing-a-parameter).)

> **In one sentence.** An implementation is a named value of an effect; `with` hands one to the code
> on its left, the entry point hands the platform's to `main`, and every operation uses the nearest
> one in scope whose type matches.
{: .tip}

Next: putting `with` to work —
[Testing effects]({{ '/docs/testing-effects/' | relative_url }}).
