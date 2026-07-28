---
title: Discharging effects
nav_title: Discharging effects
order: 19
part: Effects
summary: Turning effectful code into plain values — catch, else, provide, the run… family, the direct-call rule, and why a discharged effect never appears in your row.
---

An effect declared in a signature has to be *discharged* somewhere — handled, given meaning, and
removed from the type. Discharge combinators are how effectful code becomes a plain value, and they
read like plain English.
{: .docs-lead}

## Two flavours of discharge

**Recover-and-continue** reads infix and never exposes a wrapper type — you handle the effect and
keep the plain value:

```eliot
parseBad catch (err -> fallbackValue)     // Throw: recover the error to the success type
lookupConfig("db.url") else "<absent>"    // Abort: supply a fallback
```

**Materialise-as-data** turns the outcome into a value you can inspect:

```eliot
runThrow(parseBad)                        // Either[E, A] — Right on success, Left on raise
runAbort(lookupConfig("db.url"))          // Option[A] — None if it aborted
runStateToPair("before", rename("after")) // Pair[result, finalState], from an initial state
provide(Database("jdbc://app-db"), run)   // Dep: inject the dependency, keep the result
```

Both flavours do the same thing to the *type*: the discharged effect disappears from the row. A
`{Console, Throw[String]} Config` computation under a `catch` is just `{Console} Config` — the
failure has been handled, so it is no longer something the code "may do".

## The direct-call rule

A discharger takes the computation it is about to run as a parameter, so **hand it the expression
directly**:

```eliot
def outcome: Pair[String, String] = runStateToPair("before", rename("after"))   // yes
def outcome: Pair[String, String] = rename("after").runStateToPair("before")   // no
```

The second spelling routes an unrun computation through the dot operator's *subject* slot, which is
declared to carry values only — so it is a compile error naming the direct-call form. This is rule 3
from [When effects run]({{ '/docs/effect-evaluation/' | relative_url }}); the **infix** dischargers
`catch` and `else` are unaffected, because they already resolve to a direct call.

Nesting is how you combine them, innermost first:

```eliot
runStateToPair(s0, logic else fallback)   // else wraps the call, runStateToPair wraps that
```

> **You may bind a computation to a `val` first.** `val host = setting("host")` binds the
> computation, and `host else "localhost"` discharges it afterwards — the effect has not been
> sequenced away, so the discharger still sees what it needs. This is a change from earlier versions
> of Eliot, where a `val` had to be avoided in front of a discharge.
{: .note}

## Handled means undeclared

The used-must-be-declared rule counts effects you *perform* — and an effect your body fully
discharges is not performed, so you don't declare it. The everyday case is `if..else`: a bare
`if(condition, value)` is an `{Abort}` expression, and the `else` discharges it, so this function is
honestly just `{Console}`:

```eliot
def demo(flag: Bool): {Console} Unit = printLine(if(flag, "ON") else "OFF")
```

The same applies to any effect: raise inside, `catch` inside, and `Throw` never appears in your
signature. Discharge is how effects *end*; the row only ever lists what escapes.

## The pure boundary just works

When everything is discharged the result is a plain value, usable in a completely pure function
with no ceremony at the boundary:

```eliot
def setting(key: String): {Abort} String = abort

def sign(f: Bool): String = if(f, "+") else "-"
def port: String = setting("port") else "8080"
def tryPort: Option[String] = runAbort(setting("port"))
```

All three are pure functions — no row, and nothing left over to unwrap. Behind the scenes the
compiler runs what remains on the *identity* carrier and unwraps it; you never write that step. (The
one time you do write it is when you hold a computation you stored yourself — see
[Carriers and pinned rows]({{ '/docs/carriers/' | relative_url }}).)

## Handlers may themselves be effectful

A recovery handler runs in the same context as the computation it recovers, so it may perform
effects of its own — logging a failure before substituting a default is ordinary code:

```eliot
data NetError(reason: String)

def report(e: NetError): {Console} String = {
   printLine(reason(e))
   "<fallback>"
}

def load(url: String): {Console} String = fetch(url) catch report
```

`Throw[NetError]` is discharged; `Console` — performed by the handler — stays in the row, which is
exactly right.

## Repeated effects: one discharger per layer

Two dependencies take two nested `provide`s; two error types take two `catch`es, each selecting its
layer by the handler's parameter type:

```eliot
def main: {Console} Unit =
   provide(Topic("events"), provide(Database("jdbc://app-db"), describe))

def config: Config =
   loadConfig("https://cfg") catch ((n: NetError) -> defaultConfig) catch ((p: ParseError) -> defaultConfig)
```

Each discharger peels exactly one effect layer; the rest keep floating.

## Writing your own handler

Discharging is not reserved for the standard library. A function that *receives* an effectful
computation and handles it is a handler, and it is ordinary Eliot:

```eliot
import eliot.carrier.Effect

def orZero[G[_] ~ Effect](computation: {Throw[String] | G} Int): G[Int] =
   computation catch (_ -> 0)
```

Callers hand `orZero` a raising computation and get one that no longer raises; `Throw[String]` drops
out of their row automatically, with nothing to annotate. Two things in that signature need the
model underneath — the `{… | G}` parameter spelling, and why the result must stay on `G` — and both
are the subject of the next chapter.

Next: the model beneath the rows —
[Carriers and pinned rows]({{ '/docs/carriers/' | relative_url }}).
