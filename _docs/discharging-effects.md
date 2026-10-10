---
title: Discharging effects
nav_title: Discharging effects
order: 19
part: Effects
summary: Turning effectful code into plain values — catch, else, provide, the run… family, how nesting decides the outcome, and why a discharged effect never appears in your uses clause.
---

An effect declared in a signature has to be *discharged* somewhere — handled, given meaning, and
removed from the signature. Discharge combinators are how effectful code becomes a plain value, and they
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

Both flavours do the same thing to the *signature*: the discharged effect disappears from it. Code
that uses `Console` and `Throw[String]`, put under a `catch`, only uses `Console` — the failure has
been handled, so it is no longer something the code "may do".

How that works is unremarkable on purpose. A discharger is an ordinary function with a
[code parameter]({{ '/docs/effect-evaluation/' | relative_url }}) that is *given* the effect it
handles:

```eliot
def catch[E, A](computation uses *, Throw[E]: A, onError uses *: E => A): A
```

`computation uses *, Throw[E]: A` reads *"your code, using your effects, plus a `Throw[E]` that I
give it"*. The argument arrives **unrun**; the discharger installs a handler (for `Throw`, the
place a `raise` exits to), runs the computation inside it, and returns a plain value. The `raise`
calls inside the argument use that handler, so they never reach your `uses` clause.

## Hand the discharger the computation

A discharger takes the computation it is about to run as a parameter, so **write the computation in
that parameter**:

```eliot
def outcome: Pair[String, String] = runStateToPair("before", rename("after"))   // yes
def outcome: Pair[String, String] = rename("after").runStateToPair("before")   // no
```

The second spelling puts `rename("after")` in the dot operator's *subject* slot, which takes a
value — so, by [rule 1]({{ '/docs/effect-evaluation/' | relative_url }}), it runs right there, before
`runStateToPair` is ever called. Its `State` effect is then performed by `outcome` itself, which
declares no `uses`, and the compiler says so at the call. The **infix** dischargers `catch` and `else`
read naturally either way, because their left operand already *is* the code parameter.

Nesting is how you combine them, innermost first:

```eliot
runStateToPair(s0, logic else fallback)   // else wraps the call, runStateToPair wraps that
```

> **A `val` binds the value, not the computation.** The right-hand side of a `val` is an ordinary
> position, so `val host = setting("host")` *runs* the lookup there and binds the `String`. By the
> time you write `host else "localhost"` there is nothing left to discharge, and the compiler reports
> the `Abort` at the `val`, where it was performed. Put the discharge on the right-hand side
> instead: `val host = setting("host") else "localhost"`.
{: .note}

## Handled means undeclared

The used-must-be-declared rule counts effects you *perform* — and an effect your body fully
discharges is not performed, so you don't declare it. The everyday case is `if..else`: a bare
`if(condition, value)` uses `Abort`, and the `else` discharges it, so this function honestly uses
just `Console`:

```eliot
def demo(flag: Bool) uses Console: Unit = printLine(if(flag, "ON") else "OFF")
```

The same applies to any effect: raise inside, `catch` inside, and `Throw` never appears in your
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
boundary.

## Handlers may themselves be effectful

`catch`'s handler is a code parameter too (`onError uses *: E => A`), so it may use the caller's
effects — logging a failure before substituting a default is ordinary code:

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

## Repeated effects: one discharger each

Two dependencies take two nested `provide`s; two error types take two `catch`es, each selecting its
error type by the handler's parameter type:

```eliot
def main uses Console: Unit =
   provide(Topic("events"), provide(Database("jdbc://app-db"), describe))

def config: Config =
   loadConfig("https://cfg") catch ((n: NetError) -> defaultConfig) catch ((p: ParseError) -> defaultConfig)
```

Each discharger handles exactly one effect; the rest keep floating.

## Writing your own handler

Discharging is not reserved for the standard library. A function whose code parameter is given an
effect receives that argument unrun, and may handle it — which makes it a discharger, in ordinary
Eliot:

```eliot
def orZero(computation uses *, Throw[String]: Int): Int = computation catch ((err: String) -> 0)
```

Read the signature as English: *"give me code that may raise a `String`, and I return an `Int`."*
Callers hand `orZero` a raising computation and get a plain value back; `Throw[String]` never reaches
their `uses` clause.

The handler names its error type, `(err: String)`, for a reason. When `catch` is handed a
*parameter* rather than a call, there is no callee declaration to say which `Throw` it is
discharging, and the compiler refuses to guess — a `catch` for the wrong error type would install a
handler the `raise` never reaches. It asks you to write the type out, either in the handler as here
or as `catch[String, Int](computation, _ -> 0)`. Whatever *else* the argument performs — printing,
say — is what the `*` covers: it stays the caller's, using the caller's own `Console`.

A function **with a body gives its code only what it has.** `orZero` can promise `Throw[String]`
because it passes `computation` straight on to `catch`, which installs the handler. A function that
promised an effect and had nothing to give it from would be rejected:

```eliot
def launder(body uses *, Console: Unit): Unit = body
```

```text
error: 'body' is given the effect 'Console' here, which this definition has no implementation
       of to give.
```

The default implementation of an effect like `Console` is handed out at `main` and nowhere else, so
a function cannot quietly print on behalf of code that never declared it.

There is no type parameter for "the rest of the effects" — that is the `*` — no wrapper type in the
result and no special rule about what the result may be: an effect your parameter is given and your
body handles simply ends there.

Next: the model beneath the `uses` clauses —
[Implementations and `with`]({{ '/docs/implementations/' | relative_url }}).
