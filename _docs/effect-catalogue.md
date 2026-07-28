---
title: The effect catalogue
nav_title: Effect catalogue
order: 18
part: Effects
summary: The shipped effects — Console, Log, Throw, Abort, State, Writer, Dep, and Inf — with their operations, dischargers, and whether each can be stored in a pinned row.
---

Eliot ships a small set of built-in effects. Each brings a few operations and has a matching way to
discharge it. This chapter is the reference tour; skim it once, then come back to it.
{: .docs-lead}

The one-table view, before the details:

| Effect | Operations | Discharged by | Storable? |
|---|---|---|---|
| `{Console}` | `printLine(s)`, `readLine` | run by the platform (may reach `main`) | no |
| `{Log}` | `log(s)` | run by the platform (may reach `main`) | no |
| `{Abort}` | `abort` (untyped short-circuit) | infix `else`; `runAbort` → `Option[A]` | yes |
| `{Throw[E]}` | `raise(err)`, `orRaise(either)` | infix `catch (e -> …)`; `runThrow` → `Either[E, A]` | yes |
| `{State[S]}` | `state`, `putState(s)`, `updateState(f)` | `runStateToPair` / `runStateToValue` / `runStateToFinalState` | yes |
| `{Writer[W]}` | `tell(w)` | `runWriterToPair` / `runWriterToValue` / `runWriterToLog` | yes |
| `{Dep[X]}` | `dependency` (type-dispatched read) | `provide(value, computation)` | yes |
| `{Inf}` | `forever(step)` | never discharged — may reach `main` | no |

Every effect above is **ambient**: the whole `eliot.effect` package is auto-imported, operations and
dischargers included, so none of the code below needs an import line.

The last column is about storing a computation in a `data` field, which needs a
[pinned row]({{ '/docs/carriers/' | relative_url }}#pinned-rows-a-row-that-is-a-type). The five
*control* effects have a pure meaning, so they can be stored; the platform-bound ones cannot —
handle them before you store.

## `Console` — talk to the outside

```eliot
def echo: {Console} Unit = printLine(readLine)
```

`printLine(s)` writes a line; `readLine` yields one (a plain `String`, direct style). There is no
in-language discharger — `Console` is performed by the platform, so it typically floats all the way
to `main`. In tests, handle it before asserting, or structure the code so the logic under test
doesn't print.

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

Different error types compose freely in one row, and each `catch` picks its layer by the handler's
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
read-modify-write convenience. Nothing actually mutates — the state is threaded through the
computation — which is why a `{State[S]}` function stays pure enough to run in a test.

Discharge by running from an initial value; note the initial value comes **first**, and the
computation is passed directly rather than dot-chained:

```eliot
def demo: Pair[String, String] = runStateToPair("first", swap("second"))
// Pair("first", "second") — the returned old value, and the final state
```

`runStateToValue` keeps only the result, `runStateToFinalState` only the final state.

## `Writer[W]` — accumulate an output

```eliot
def notes: {Writer[String]} Unit = {
   tell("first ")
   tell("second")
}

def collected: Pair[Unit, String] = runWriterToPair(notes)
// Pair(unit, "first second")
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
def serve: {Console, Inf} Unit = forever(printLine(readLine))
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

This is the shape every library effect takes — an `ability` plus operations — and it is exactly what
your own effects will look like. Defining one needs no compiler support:

```eliot
ability Metric[F[_]] {
   def count(name: String): F[Unit]
}
```

Next: how effects leave a row — [Discharging effects]({{ '/docs/discharging-effects/' | relative_url }}).
