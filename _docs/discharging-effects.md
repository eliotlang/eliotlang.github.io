---
title: Discharging effects
nav_title: Discharging effects
order: 18
part: Effects
summary: Turning effectful code into plain values — catch, else, provide and the run… family, the pure boundary, the one rule about where to write the computation, and how a handler of your own is declared.
---

An effect declared in a signature has to be handled somewhere. **Discharging** an effect means
running the code that uses it inside a handler and getting a plain value back — the effect is given
its meaning, and it leaves the signature. The dischargers read like plain English, and this chapter
is about using them well.
{: .docs-lead}

## Two flavours of discharge

**Recover-and-continue** reads infix and never shows you a wrapper type: you handle the effect and
keep the plain value.

```eliot
parseBad catch (err -> fallbackValue)     // Throw: recover the error to the success type
lookupConfig("db.url") else "<absent>"    // Abort: supply a fallback
```

**Materialise-as-data** turns the outcome into a value you can inspect:

```eliot
runThrow(parseBad)                        // Either[E, A] — Right on success, Left on raise
runAbort(lookupConfig("db.url"))          // Option[A] — none if it aborted
runStateToPair("before", rename("after")) // Pair[result, finalState], from an initial state
provide(Database("jdbc://app-db"), run)   // Dep: inject the dependency, keep the result
```

Both flavours do the same thing to the *signature*: the discharged effect disappears from it. Code
that uses `Console` and `Throw[String]`, put under a `catch`, only uses `Console` — the failure has
been handled, so it is no longer something the code "may do".

## Handled means undeclared

The used-must-be-declared rule counts effects you *perform*, and an effect your body fully
discharges is not performed by your function — so you don't declare it. The everyday case is
`if..else`: a bare `if(condition, value)` uses `Abort`, and the `else` discharges it, so this
function honestly uses just `Console`:

```eliot
def demo(flag: Bool) uses Console: Unit = printLine(if(flag, "ON") else "OFF")
```

The same holds for every effect: raise inside, `catch` inside, and `Throw` never appears in your
signature. Discharge is how effects *end*; the `uses` clause only ever lists what escapes.

## The pure boundary just works

When everything is discharged the result is a plain value, usable in a completely pure function
with no ceremony at the boundary:

```eliot
def setting(key: String) uses Abort: String = abort

def sign(f: Bool): String = if(f, "+") else "-"
def port: String = setting("port") else "8080"
def tryPort: Option[String] = runAbort(setting("port"))
```

All three are pure functions — no `uses`, and nothing left over to unwrap. A discharger returns an
ordinary value (`String`, `Option[String]`), so there is no wrapper type and no "run" step at the
boundary. The same discharge works just as well in the middle of an effectful function:
`printLine(setting("host") else "localhost")` inside a `uses Console` body discharges the `Abort`
and leaves `Console` alone.

## The one rule: hand the discharger its computation

A discharger takes the computation it is about to run as a **parameter**. So write the computation
in that parameter position — as an argument, not as the subject of a dot:

```eliot
def outcome: Pair[String, String] = runStateToPair("before", rename("after"))   // yes
def outcome: Pair[String, String] = rename("after").runStateToPair("before")   // no
```

The second spelling puts `rename("after")` in the dot operator's *subject* slot. A subject is an
ordinary value, so it is computed right there, before `runStateToPair` is ever called — its `State`
effect is performed by `outcome` itself, which declares no `uses`, and the compiler reports exactly
that at the call. The **infix** dischargers `catch` and `else` are unaffected, because their left
operand already *is* the parameter that takes the computation.

> **A `val` binds the value, not the computation.** The right-hand side of a `val` is an ordinary
> position too, so `val host = setting("host")` *runs* the lookup there and binds the `String`. By
> the time you write `host else "localhost"` there is nothing left to discharge, and the compiler
> reports the `Abort` at the `val`, where it was performed. Put the discharge on the right-hand side
> instead: `val host = setting("host") else "localhost"`.
{: .note}

Why a discharger's parameter is different from an ordinary one — why it receives the computation
*unrun* — is the subject of [Values and code]({{ '/docs/effect-evaluation/' | relative_url }}).
For now the rule is enough: **arguments to dischargers, left operands of `catch` and `else`.**

## Handlers may themselves be effectful

The handler you give `catch` is ordinary code written in your function, so it may use your
function's effects. Logging a failure before substituting a default needs nothing special:

```eliot
data NetError(reason: String)

def fetch(url: String) uses Throw[NetError]: String = raise(NetError("unreachable: " ++ url))

def report(e: NetError) uses Console: String = {
   printLine(reason(e))
   "<fallback>"
}

def load(url: String) uses Console: String = fetch(url) catch report
```

`Throw[NetError]` is discharged; `Console` — used by the handler — stays in `load`'s clause, which
is exactly right.

## One discharger per effect

Each discharger handles exactly one effect, and the rest keep floating. Two dependencies take two
nested `provide`s; two error types take two `catch`es, each selecting its error type by the
handler's parameter type:

```eliot
def main uses Console: Unit =
   provide(Topic("events"), provide(Database("jdbc://app-db"), describe))

def config: Config =
   loadConfig("https://cfg") catch ((n: NetError) -> defaultConfig) catch ((p: ParseError) -> defaultConfig)
```

Nesting is also how dischargers for *different* effects combine, innermost first:

```eliot
runStateToPair(s0, logic else fallback)   // else wraps logic, runStateToPair wraps that
```

When the effects interact — state and failure, say — the nesting order decides what happens, and the
[next chapter]({{ '/docs/combining-effects/' | relative_url }}) is about exactly that.

## How a discharger is declared

Everything above works without knowing how `catch` is written. Here is its signature, because it
is the key to writing handlers of your own:

```eliot
def catch[E, A](computation uses *, Throw[E]: A, onError uses *: E => A): A
```

A `uses` clause on a **parameter** means the parameter takes **code** rather than a value.
`computation uses *, Throw[E]: A` reads *"code my caller wrote, producing an `A`, which may use
my caller's effects (`*`) **plus** a `Throw[E]` that I give it"*. The argument arrives unrun; the
discharger installs a handler — the place a `raise` exits to — runs the computation inside it, and
returns a plain value. The `raise` calls inside the argument use that handler, which is why they
never reach your `uses` clause.

This is the whole of what a discharger is: a function whose parameter is *given* an effect. There
is no type parameter for "the rest of the effects" (that is the `*`), no wrapper type in the result,
and no special rule about what the result may be.

## Writing your own handler

Discharging is not reserved for the standard library. A function whose parameter is given an effect
receives that argument unrun and may handle it — which makes it a discharger, in ordinary Eliot:

```eliot
def orZero(computation uses *, Throw[String]: Int): Int = computation catch ((err: String) -> 0)
```

Read the signature as English: *"give me code that may raise a `String`, and I return an `Int`."*
Callers hand `orZero` a raising computation and get a plain value back; `Throw[String]` never
reaches their `uses` clause.

Two details are worth knowing when you write one:

- **The handler names its error type**, `(err: String)`, for a reason. When `catch` is handed a
  *parameter* rather than a call, there is no callee declaration to say which `Throw` is being
  discharged, and the compiler refuses to guess — a `catch` for the wrong error type would install a
  handler the `raise` never reaches. It asks you to write the type out, in the handler as here or
  as `catch[String, Int](computation, _ -> 0)`. Whatever *else* the argument performs — printing,
  say — is what the `*` covers: it stays the caller's, using the caller's own `Console`.
- **A function with a body gives its code only what it has.** `orZero` can promise `Throw[String]`
  because it passes `computation` straight on to `catch`, which installs the handler. A function
  that promised an effect and had nothing to give it from is rejected:

```eliot
def launder(body uses *, Console: Unit): Unit = body
```

```text
error: 'body' is given the effect 'Console' here, which this definition has no implementation
       of to give.
```

The default implementation of `Console` is handed out at `main` and nowhere else, so a function
cannot quietly print on behalf of code that never declared it. A discharger can only ever give what
it discharges, or what it was given itself.

> **In one sentence.** A discharger is a function whose parameter is given an effect; it runs your
> computation inside a handler for that effect and returns a plain value, so the effect never reaches
> your signature — and you write the computation as its argument.
{: .tip}

Next: what happens when several effects meet —
[Combining and ordering effects]({{ '/docs/combining-effects/' | relative_url }}).
