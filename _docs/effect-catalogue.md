---
title: The effect catalogue
nav_title: Effect catalogue
order: 17
part: Effects
summary: The shipped effects — Console, Log, Abort, Throw, State, Writer, Dep, and Inf — with their operations and how each is handled, the effects beyond the prelude, and what declaring your own looks like.
---

Eliot ships a small set of effects. Each brings a few operations and has a matching way to be
handled. This chapter is the tour: read it once to know what exists, then come back to it as a
reference.
{: .docs-lead}

The one-table view, before the details:

| Effect | Operations | Handled by |
|---|---|---|
| `Console` | `printLine(s)`, `readLine` | the platform, at `main`; a test's fake via `with` |
| `Log` | `log(s)` | the platform, at `main`; a test's fake via `with` |
| `Abort` | `abort`, `orAbort(option)` | infix `else`; `runAbort` → `Option[A]` |
| `Throw[E]` | `raise(err)`, `orRaise(either)` | infix `catch (e -> …)`; `runThrow` → `Either[E, A]` |
| `State[S]` | `state`, `putState(s)`, `updateState(f)` | `runStateToPair` / `runStateToValue` / `runStateToFinalState` |
| `Writer[W]` | `tell(w)` | `runWriterToPair` / `runWriterToValue` / `runWriterToLog` |
| `Dep[X]` | `dependency` | `provide(value, computation)` |
| `Inf` | `forever(step)` | never discharged — run by the platform at `main` |

All of them are **ambient**: the whole `eliot.effect` package is auto-imported, operations and
dischargers included, so none of the code below needs an import line.

## Two families

Nothing in the language distinguishes them, but the effects fall into two groups, and knowing which
one you are holding tells you how it ends:

- **Interpretation effects** — `Console` and `Log` here, plus `FileSystem`, `Environment` and
  `Process` further down, and every effect you declare yourself — talk to the world. They have no
  pure meaning to discharge into, so they float up to `main`, where the platform's default
  implementation performs them. A test binds a different implementation with
  [`with`]({{ '/docs/implementations/' | relative_url }}).
- **Control effects** — `Abort`, `Throw`, `State`, `Writer`, `Dep` and `Inf` — are about control
  flow and data. Each has exactly one implementation per platform, so there is nothing to choose;
  instead you **discharge** them into plain values: an `Option`, an `Either`, a `Pair`.

The rest of this chapter takes them one at a time.

## `Console` — talk to the outside

```eliot
def echo uses Console: Unit = printLine(readLine orElse "(no input)")
```

`printLine(s)` writes a line; `readLine` yields one as an `Option[String]` — `none` at the end of
input, which is an ordinary outcome rather than a failure. Supply a default with `orElse`, or turn
the absence into an `Abort` with `orAbort(readLine)` and handle it with `else`. There is no
discharger — `Console` is performed by the platform, so it typically floats all the way to `main`.
In a test, bind a fake console with `with` (see
[Testing effects]({{ '/docs/testing-effects/' | relative_url }})).

## `Log` — diagnostics

```eliot
def audit(action: String) uses Log: Unit = log(action)
```

`log(s)` emits a diagnostic message; the *platform* chooses the destination (stderr on the JVM, a
serial port on a microcontroller). Like `Console` it is platform-performed and may reach `main`.
Prefer `Log` over `printLine` for anything that isn't the program's actual output.

## `Abort` — fail without a reason

```eliot
def lookupConfig(key: String) uses Abort: String = if(key == "app.name", "config-value")
```

`abort` short-circuits the computation. It stands in for a value of *any* type, so it drops into any
position. The bare `if` above is the everyday source of it: when the condition does not hold, `if`
has no value to give, and aborts ([Branching]({{ '/docs/branching/' | relative_url }})).

Discharge with the infix `else` (supply a fallback) or `runAbort` (materialise an `Option[A]`):

```eliot
def url: String = lookupConfig("db.url") else "jdbc://default"
def tryUrl: Option[String] = runAbort(lookupConfig("db.url"))
```

Both `url` and `tryUrl` are pure: the `Abort` is handled inside them, so it never reaches their
signatures.

## `Throw[E]` — fail with a typed error

```eliot
data ParseError(detail: String)

def parse(raw: String) uses Throw[ParseError]: Config = raise(ParseError("unexpected token"))
```

`raise(err)` stops with an error value; like `abort` it stands in for any type. Discharge with the
infix `catch (e -> …)` (recover to the success type) or `runThrow` (materialise an `Either[E, A]`).
`orRaise(either)` is the inverse: it turns an `Either` back into the effect, which is how an
error-as-value result enters the effect world:

```eliot
def parsed(input: String) uses Throw[String]: Tree = orRaise(tryParse(input))
```

Different error types compose freely in one clause, and each `catch` picks its error type from the
handler's parameter type:

```eliot
def loadConfig(url: String) uses Throw[NetError], Throw[ParseError]: Config = parse(fetch(url))

def config: Config =
   loadConfig("https://cfg") catch ((n: NetError) -> defaultConfig) catch ((p: ParseError) -> defaultConfig)
```

Use `String` as `E` to just signal a problem; define your own error `data` types when callers
should recover differently per case.

## `State[S]` — a threaded cell

```eliot
def swap(next: String) uses State[String]: String = {
   val old = state
   putState(next)
   old
}

def tick uses State[Int]: Unit = updateState(n -> n + 1)
```

`state` reads the current value, `putState(s)` replaces it, and `updateState(f)` is the
read-modify-write convenience. The state lives in a cell that the discharger creates for the
duration of its call and nothing else can reach, so a `uses State[S]` function is still
deterministic, and runs in a test like any pure function.

Discharge by running from an initial value. The initial value comes **first**, and the computation
is passed as an argument:

```eliot
def demo: Pair[String, String] = runStateToPair("first", swap("second"))
// pair("first", "second") — the returned old value, and the final state
```

`runStateToValue` keeps only the result, `runStateToFinalState` only the final state.

## `Writer[W]` — accumulate an output

```eliot
def notes uses Writer[String]: Unit = {
   tell("first ")
   tell("second")
}

def collected: Pair[Unit, String] = runWriterToPair(notes)
// pair(unit, "first second")
```

`tell(w)` appends to an accumulated log; the pieces are joined with `W`'s `Combine` instance as the
computation runs. `Writer` is `State` restricted to append-only — a function can contribute but can
never read back what has been accumulated, which is the honest contract for a collector.
`runWriterToValue` and `runWriterToLog` keep one side of the pair; `runWriterToLog` is the usual
one, and it is what a test uses to read a fake's transcript.

## `Dep[X]` — an injected dependency

```eliot
data Database(url: String)

def describe uses Dep[Database], Console: Unit = printLine(dependency.url)
```

`dependency` reads the injected value, and it is **type-dispatched**: the type expected at the use
site decides *which* dependency is read, so one function can pull several
(`uses Dep[Database], Dep[Topic]`) and each `dependency` finds its own. Discharge with
`provide(value, computation)` — dependency injection at the discharge site, one `provide` per
dependency type:

```eliot
def main uses Console: Unit = provide(Database("jdbc://app-db"), describe)
```

## `Inf` — deliberately forever

```eliot
def serve uses Console, Inf: Unit = forever(printLine(readLine orElse "(no input)"))
```

Eliot programs [terminate by default]({{ '/docs/totality/' | relative_url }}); `Inf` is the opt-out.
`forever(step)` runs its step endlessly, and `Inf` propagates like any other effect, so a caller
that does not declare `uses Inf` cannot call `serve`. It is the one effect that is *meant* to reach
`main` undischarged: a server loop or a firmware main loop declares it, and the platform runs it
forever.

## Beyond the prelude

Not every effect is ambient. Three more ship with the standard library, imported like any other
module, and they follow exactly the same rules:

- **`FileSystem`** (`eliot.file.File`) — whole-file reads and writes, folds over lines, directory
  listings. Every operation may fail, and says so: a filesystem program declares
  `uses FileSystem, Throw[IoError]`, and `catch` handles the failures while `FileSystem` itself keeps
  floating to `main`.
- **`Environment`** (`eliot.system.Environment`) — the program's arguments, environment variables,
  and working directory.
- **`Process`** (`eliot.system.Process`) — running other programs, and registering this program's
  exit code.

```eliot
import eliot.file.File
import eliot.file.Path

def greetingFrom(p: Path) uses FileSystem, Throw[IoError]: String = readFile(p)
```

Notice the shape of `readFile`'s own declaration inside the effect — a member lists what it uses
*beyond* the effect it belongs to:

```eliot
effect FileSystem {
   def readFile(path: Path) uses Throw[IoError]: String
}
```

A target without a filesystem simply ships no default `FileSystem` implementation, so a program
using it is refused for that target at the entry point. The layer system *is* the capability model.

## Your own effects

Every library effect above is an `effect` declaration plus operations, and that is exactly what
your own look like. Declaring one needs no compiler support:

```eliot
effect Metric {
   def count(name: String): Unit
}

def handle(request: String) uses Metric, Console: Unit = {
   count("requests")
   printLine(request)
}
```

A new effect has no default implementation until someone writes one — an anonymous
`implement Metric { … }` in its own module for production, or a named one that a test binds with
`with`. Both are the subject of
[Implementations and `with`]({{ '/docs/implementations/' | relative_url }}). Until then, `Metric`
reaching `main` is an error at the entry point naming it — the honest state of an effect nobody has
yet said how to run.

Next: how effects leave a signature — [Discharging effects]({{ '/docs/discharging-effects/' | relative_url }}).
