---
title: Discharging effects
nav_title: Discharging effects
order: 18
part: Effects
summary: Turning effectful code into plain values at the boundary — catch, else, provide, the run… family, the wrap-the-computation rule, and discharge-aware accounting.
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
runStateToPair(rename("after"), "before") // Pair[result, finalState], from an initial state
provide(Database("jdbc://app-db"), run)   // Dep: inject the dependency, keep the result
```

Both flavours do the same thing to the *type*: the discharged effect disappears from the row. A
`{Console, Throw[String]} Config` computation under a `catch` is just `{Console} Config` — the
failure has been handled, so it is no longer something the code "may do".

## The wrap-the-computation rule

A discharger wraps the *computation expression* — pass the effectful call to it directly:

```eliot
runStateToPair(logic else fallback, s0)   // good: else wraps the call, runState wraps that
```

> **Don't bind first, discharge later.** A `val x = effectfulCall` line already sequences the
> effect into the surrounding computation and binds the *plain* value — so a discharger applied to
> `x` afterwards sees a bare value where it expects an effectful computation, and you get a type
> mismatch. The same goes for dot-chaining a discharger (`computation.catch(…)`): call dischargers
> directly, nesting them as needed.
{: .warn}

## Discharge-aware accounting: handled means undeclared

The used-must-be-declared rule counts effects you *perform* — and an effect your body fully
discharges is not performed, so you don't declare it. The everyday case is `if..else`: a bare
`if(condition, value)` is an `{Abort}` expression, and the `else` discharges it, so this function
is honestly just `{Console}`:

```eliot
import eliot.effect.Console
import eliot.effect.Abort

def demo(flag: Bool): {Console} Unit = printLine(if(flag, "ON") else "OFF")
```

The same applies to any effect: raise inside, `catch` inside, and `Throw` never appears in your
signature. Discharge is how effects *end*; the row only ever lists what escapes.

## The pure boundary just works

When everything is discharged, the result is a plain value — usable in a completely pure function,
with no ceremony at the boundary:

```eliot
import eliot.effect.Abort

def setting(key: String): {Abort} String = abort

def sign(f: Bool): String = if(f, "+") else "-"
def port: String = setting("port") else "8080"
def tryPort: Option[String] = runAbort(setting("port"))
```

All three are pure functions. Behind the scenes the leftover carrier defaults to the identity
carrier `Id` and unwraps automatically — you never see it. (If you *have* pinned a computation over
`Id` yourself — a stored `{Throw[E] | Id} A` field, say — the explicit unwrap is `runId`, from
`eliot.lang.Id`.)

## Repeated effects: one discharger per layer

Two dependencies take two nested `provide`s; two error types take two `catch`es, each pinned by its
handler's parameter type:

```eliot
def main: {Console} Unit =
   provide(Topic("events"), provide(Database("jdbc://app-db"), describe))

def config: Config =
   loadConfig("https://cfg") catch ((n: NetError) -> defaultConfig) catch ((p: ParseError) -> defaultConfig)
```

Each discharger peels exactly one effect layer; the rest keep floating.

## Your own handlers — discharge is inferred

Discharging is not reserved for the stdlib. A function that receives an effectful computation and
handles it is a *handler*. Spell the parameter as a
[pinned row over a generic base]({{ '/docs/effects/' | relative_url }}#advanced-generic-programming-against-effects)
`G` — "a computation that may raise, over whatever else it does" — handle the effect, and return
on `G`:

```eliot
import eliot.effect.Effect
import eliot.effect.Throw

def orZero[G[_] ~ Effect](computation: {Throw[String] | G} Int): G[Int] =
   computation catch (_ -> 0)
```

Callers hand `orZero` a raising computation and get one that no longer raises — `Throw[String]` is
subtracted from their accounting automatically, and no `{-E}` annotation was needed: the compiler
**infers** the discharge from the body. (The stdlib's own dischargers carry the explicit marker —
`runThrow[E, G[_], A](obj: {Throw[E] | G} A): {-Throw[E]} G[Either[E, A]]` — because as abstract
primitives they have no body to infer from.)

One rule to remember when writing handlers: the effectful parameter's carrier **belongs to your
caller**, so your result must stay on it — return `G[Int]`, never a bare `Int`. Only the caller
can take their carrier to a pure boundary.

Next: what happens when several effects meet —
[Combining and ordering effects]({{ '/docs/combining-effects/' | relative_url }}).
