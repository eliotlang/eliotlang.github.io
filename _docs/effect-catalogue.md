---
title: The effect catalogue
nav_title: Effect catalogue
order: 18
part: Effects
summary: The shipped effects — Console, Log, Throw, Abort, State, Writer, Dep, and Inf — with their operations, and how each is discharged or implemented.
---

Eliot ships a small set of built-in effects. Each brings a few operations and has a matching way to
discharge it. This chapter is the reference tour; skim it once, then come back to it.
{: .docs-lead}

The one-table view, before the details:

| Effect | Operations | Handled by |
|---|---|---|
| `{Console}` | `printLine(s)`, `readLine` | the platform's default at `main`; a test's fake via `with` |
| `{Log}` | `log(s)` | the platform's default at `main`; a test's fake via `with` |
| `{Abort}` | `abort` (untyped short-circuit), `orAbort(option)` | infix `else`; `runAbort` → `Option[A]` |
| `{Throw[E]}` | `raise(err)`, `orRaise(either)` | infix `catch (e -> …)`; `runThrow` → `Either[E, A]` |
| `{State[S]}` | `state`, `putState(s)`, `updateState(f)` | `runStateToPair` / `runStateToValue` / `runStateToFinalState` |
| `{Writer[W]}` | `tell(w)` | `runWriterToPair` / `runWriterToValue` / `runWriterToLog` |
| `{Dep[X]}` | `dependency` (type-dispatched read) | `provide(value, computation)` |
| `{Inf}` | `forever(step)` | never discharged — run by the platform at `main` |

Every effect above is **ambient**: the whole `eliot.effect` package is auto-imported, operations and
dischargers included, so none of the code below needs an import line.

They come in two families. `Console` and `Log` are **interpretation effects**: the platform ships a
default implementation, and a test or an application may bind another with
[`with`]({{ '/docs/implementations/' | relative_url }}). The rest are **control effects**: one
implementation per platform, nothing to choose, and you *discharge* them instead. Any of them may be
stored in a [`data` field]({{ '/docs/implementations/' | relative_url }}#storing-a-computation-in-a-data-field).

## `Console` — talk to the outside

```eliot
def echo: {Console} Unit = printLine(readLine orElse "(no input)")
```

`printLine(s)` writes a line; `readLine` yields one as an `Option[String]` — `None` at the end of
input, which is an ordinary outcome rather than a failure. Supply a default with `orElse`, or turn it
into an `{Abort}` with `orAbort(readLine)`. There is no discharger — `Console` is performed by the
platform's implementation, so it typically floats all the way to `main`. In tests, bind a fake
console with `with` (see [Testing effects]({{ '/docs/testing-effects/' | relative_url }})).

## `Log` — diagnostics

```eliot
def audit(action: String): {Log} Unit = log(action)
```

`log(s)` emits a diagnostic message; the *platform* chooses the destination (stderr on the JVM, a
serial port on a microcontroller). Like `Console` it is platform-performed and may reach `main`.
Prefer `Log` over `printLine` for anything that isn't the program's actual output.

## `Abort` — fail without a reason

```eliot
def lookupConfig(key: String): {Abort} String = abort
```

`abort` short-circuits the computation. It stands in for a value of *any* type, so it drops into any
position. Discharge with the infix `else` (supply a fallback) or `runAbort` (materialise an
`Option[A]`):

```eliot
def url: String = lookupConfig("db.url") else "jdbc://default"
def tryUrl: Option[String] = runAbort(lookupConfig("db.url"))
```

`Abort` is the effect behind a bare `if(condition, value)` — which is why an `if` without an `else`
is an `{Abort}` expression, and adding the `else` discharges it (see
[Branching]({{ '/docs/branching/' | relative_url }})).

## `Throw[E]` — fail with a typed error

```eliot
data ParseError(detail: String)

def parse(raw: String): {Throw[ParseError]} Config = raise(ParseError("unexpected token"))
```

`raise(err)` stops with an error value; like `abort` it stands in for any type. Discharge with the
infix `catch (e -> …)` (recover to the success type) or `runThrow` (materialise an `Either[E, A]`).
`orRaise(either)` is the inverse — it turns an `Either` back into the effect, which is how an
error-as-value result from a native library enters the effect world:

```eliot
def parsed(input: String): {Throw[String]} Tree = orRaise(tryParse(input))
```

Different error types compose freely in one row, and each `catch` picks its error type by the handler's
parameter type:

```eliot
def loadConfig(url: String): {Throw[NetError], Throw[ParseError]} Config = parse(fetch(url))

def config: Config =
   loadConfig("https://cfg") catch ((n: NetError) -> defaultConfig) catch ((p: ParseError) -> defaultConfig)
```

Use `String` as `E` to just signal a problem; define your own error `data` types when callers should
recover differently per case.

## `State[S]` — a threaded cell

```eliot
def swap(next: String): {State[String]} String = {
   val old = state
   putState(next)
   old
}

def tick: {State[Int]} Unit = updateState(n -> n + 1)
```

`state` reads the current value, `putState(s)` replaces it, and `updateState(f)` is the
read-modify-write convenience. The state lives in a cell that the discharger creates for the duration
of its call and nothing else can reach, so a `{State[S]}` function is still deterministic and runs
in a test like any pure function.

Discharge by running from an initial value; note the initial value comes **first**, and the
computation is passed as an argument rather than dot-chained:

```eliot
def demo: Pair[String, String] = runStateToPair("first", swap("second"))
// pair("first", "second") — the returned old value, and the final state
```

`runStateToValue` keeps only the result, `runStateToFinalState` only the final state.

## `Writer[W]` — accumulate an output

```eliot
def notes: {Writer[String]} Unit = {
   tell("first ")
   tell("second")
}

def collected: Pair[Unit, String] = runWriterToPair(notes)
// pair(unit, "first second")
```

`tell(w)` appends to an accumulated log; the pieces are joined with `W`'s
`Combine` instance as the computation sequences. `Writer` is exactly `State` restricted to
append-only — a function can contribute but can never read back what has been accumulated, which is
the honest contract for a collector. `runWriterToValue` and `runWriterToLog` keep one side of the
pair.

## `Dep[X]` — an injected dependency

```eliot
data Database(url: String)

def describe: {Dep[Database], Console} Unit = printLine(dependency.url)
```

`dependency` reads the injected value, and it is **type-dispatched**: the use site's expected type
decides *which* dependency is read, so one function can pull several
(`{Dep[Database], Dep[Topic]}`) and each `dependency` finds its own. Discharge with
`provide(value, computation)` — dependency injection at the discharge site, one nested `provide` per
dependency type.

## `Inf` — deliberately forever

```eliot
def serve: {Console, Inf} Unit = forever(printLine(readLine orElse "(no input)"))
```

Eliot programs [terminate by default]({{ '/docs/totality/' | relative_url }}); `Inf` is the opt-out.
`forever(step)` runs a step endlessly, and the effect propagates like any other — a caller that
doesn't declare `{Inf}` cannot call `serve`. It is the one effect that is *meant* to reach `main`
undischarged: a server loop or a firmware main loop declares it, and the platform runs it forever.

## Beyond the prelude: `FileSystem`

Not every effect is ambient. The file API lives in `eliot.file` and is imported like any other
module; its `FileSystem` effect follows exactly the same rules as the ones above, and pairs with
`Throw[IoError]` for its failures:

```eliot
import eliot.file.File
import eliot.file.Path

def greetingFrom(p: Path): {FileSystem, Throw[IoError]} String = readFile(p)
```

This is the shape every library effect takes — an `effect` declaration plus operations — and it is
exactly what your own effects will look like. Defining one needs no compiler support:

```eliot
effect Metric {
   def count(name: String): Unit
}

def handle(request: String): {Metric, Console} Unit = {
   count("requests")
   printLine(request)
}
```

A new effect has no default implementation until someone writes one — an anonymous `implement
Metric { … }` in its module for production, or a named one a test binds with `with`.

Next: how effects leave a row — [Discharging effects]({{ '/docs/discharging-effects/' | relative_url }}).
