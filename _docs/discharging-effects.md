---
title: Discharging effects
nav_title: Discharging effects
order: 22
part: Effects
summary: Turning effectful code into plain values — catch, else, provide and the run… family, the pure boundary, the one rule about where to write the computation, and how a discharger of your own is declared.
---

An effect declared in a signature is something the caller must hand over. **Discharging** an effect
means supplying it yourself: a discharger runs the code that needs it, hands that code an
implementation it made on the spot, and gives you a plain value back. The effect has been supplied,
so it leaves the signature. The dischargers read like plain English, and this chapter is about using
them well.
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
that uses `Console` and `Throw[String]`, put under a `catch`, only uses `Console` — the `catch`
supplied the `Throw[String]`, so nobody further up has to.

## Supplied means undeclared

A `uses` clause lists what a function needs from its caller, and an effect your body discharges is
supplied inside it — so you don't declare it. The everyday case is `if..else`: a bare
`if(condition, value)` uses `Abort`, and the `else` supplies it, so this function honestly uses just
`Console`:

```eliot
def demo(flag: Bool) uses Console: Unit = printLine(if(flag, "ON") else "OFF")
```

The same holds for every effect: raise inside, `catch` inside, and `Throw` never appears in your
signature. Discharge is how effects *end*; the `uses` clause only ever lists what is left.

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
effect is performed by `outcome` itself, which has no `State` to give it, and the compiler reports
exactly that at the call. The **infix** dischargers `catch` and `else` are unaffected, because their
left operand already *is* the parameter that takes the computation.

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

Each discharger supplies exactly one effect, and the rest are passed on as before. Two dependencies
take two nested `provide`s; two error types take two `catch`es, each selecting its error type by the
handler's parameter type:

```eliot
def main uses Console: Unit =
   provide(Topic("events"), provide(Database("jdbc://app-db"), describe))

def config: Config =
   loadConfig("https://cfg") catch ((n: NetError) -> defaultConfig) catch ((p: ParseError) -> defaultConfig)
```

Each `raise` inside `loadConfig` lands in the `catch` whose error type matches it — the
[same rule]({{ '/docs/implementations/' | relative_url }}#which-implementation-an-operation-uses)
by which each `dependency` reads its own `Dep`. Nesting is also how dischargers for *different*
effects combine, innermost first:

```eliot
runStateToPair(s0, logic else fallback)   // else wraps logic, runStateToPair wraps that
```

When the effects interact — state and failure, say — the nesting order decides what happens, and the
[next chapter]({{ '/docs/combining-effects/' | relative_url }}) is about exactly that.

## How a discharger is declared

Everything above works without knowing how `catch` is written. Here is its signature, because it
is the key to writing dischargers of your own:

```eliot
def catch[E, A](computation uses *, Throw[E]: A, onError uses *: E => A) uses *: A
```

A `uses` clause on a **parameter** means the parameter takes **code** rather than a value.
`computation uses *, Throw[E]: A` reads *"code my caller wrote, producing an `A`, which may use
my caller's effects (`*`), **plus** a `Throw[E]` that I hand it"*. The argument arrives unrun;
`catch` makes a `Throw[E]` implementation whose `raise` lands in `onError`, runs the computation with
it, and returns a plain value. Every `raise` inside the argument uses that implementation — it is
the nearest one — which is why none of them reach your `uses` clause.

That is the whole of what a discharger is: a function that hands its code an implementation of its
own. There is no type parameter for "the rest of the effects" (that is the `*`), no wrapper type in
the result, and no special rule about what the result may be.

## Writing your own discharger

Discharging is not reserved for the standard library. A function whose parameter lists an effect
receives that argument unrun and may supply the effect itself — which makes it a discharger, in
ordinary Eliot:

```eliot
def orZero(computation uses *, Throw[String]: Int) uses *: Int = computation catch (err -> 0)
```

Read the signature as English: *"give me code that may raise a `String`, and I return an `Int`."*
Callers hand `orZero` a raising computation and get a plain value back; `Throw[String]` never
reaches their `uses` clause.

### Handle it or declare it

Listing an effect on a code parameter says *"I hand this code that effect"*. A function with a body
cannot conjure an implementation out of nothing, so it hands over one of the two it can have:

> **An effect a code parameter lists is the function's to handle or to declare.**
{: .note}

The function either **handles** the effect — hands the code an implementation it made, by passing
the code on to a discharger, as `orZero` passes it to `catch`, or by a
[`with` around the run]({{ '/docs/implementations/' | relative_url }}#with-around-a-run-of-code) —
or it **declares** the effect in its own `uses` clause, and hands the code the implementation its own
caller handed it. The standard library has both kinds:

```eliot
def else[A](computation uses *, Abort: A, fallback uses *: A) uses *: A               // handles Abort
def catch[E, A](computation uses *, Throw[E]: A, onError uses *: E => A) uses *: A    // handles Throw[E]
def if[T](condition: Bool, value uses *, Abort: T) uses *, Abort: T                   // declares Abort
```

That is the difference between a bare `if`, whose `Abort` reaches your function, and an `if..else`,
whose `else` answers it. Doing neither is an error at the place the code runs:

```eliot
def launder(body uses *, Console: Unit) uses *: Unit = body
```

```text
error: 'body' may perform the effect 'Console' here, which this definition neither handles nor declares.
  |  Handle it by passing 'body' to a parameter that discharges it (such as `catch` or `runThrow`) or by
  |  binding an implementation around the run with `with`, or add 'Console' to this definition's `uses`
  |  clause to pass it on to its caller.
```

The platform's `standardConsole` is handed out at `main` and nowhere else, so a function cannot
quietly print on behalf of code that never declared it: it either chooses an implementation
explicitly, or makes its own caller declare the effect.

Handling and declaring combine. A function may declare an effect *and* handle it around its code —
the handling catches the code's failure, and the declaration covers what the function raises itself.
This is how a failure message gets rewritten:

```eliot
def describedAs(label: String, body uses *, Throw[String]: String) uses *, Throw[String]: String =
   body catch ((reason: String) -> raise(label ++ ": " ++ reason))

def parseBad uses Throw[String]: String = raise("malformed input")

def outcome: Either[String, String] = runThrow(describedAs("load", parseBad))
// left("load: malformed input")
```

Where `body` runs, the nearest `Throw[String]` is the one `catch` makes, so that is what `parseBad`
is handed. The `raise` in the handler is written in `describedAs` itself, so it uses the one
`describedAs` was handed by *its* caller — here `runThrow`.

### What a parameter does not list is out of reach

An effect the code uses only through the `*` was handed over where the code was written, so the
function running the code can neither catch it nor needs to declare it. A helper's private `catch`
therefore cannot swallow a failure that was never handed to it:

```eliot
def guarded(body uses *: Unit) uses *, Console: Unit =
   catch[String, Unit](body, e -> printLine("guarded caught " ++ e))

def main uses Console: Unit =
   printLine(runThrow[String, Unit](guarded(raise("boom")))
      .foldEither(e -> "main caught " ++ e, _ -> "no failure"))
```

```text
main caught boom
```

`guarded`'s parameter lists nothing, so its `catch` intercepts nothing: the `raise` was written in
`main`, inside `main`'s `runThrow`, and it uses the implementation in scope there. Which effects a
function can touch is decided by its signature, never by what happens to be on the call stack.

### When the error type must be spelled

A discharger's type arguments are read off the code it runs: in `orZero` the computation needs a
`Throw[String]`, so `catch` is a `catch[String, Int]` without saying so, and `raise(1) catch (n -> …)`
is a `catch[Int, …]` because `1` is an `Int`. The compiler only asks when the code would decide it
two different ways, or not at all:

```eliot
def mixed(flag: Bool): String = (if(flag, raise(1)) else raise("one")) catch (e -> "caught")
```

```text
error: Which handle answers 'Throw[Int]' depends on type arguments nothing here decides.
  |  Spell the type arguments of the call around it.
```

Write them out at the discharger — `catch[Int, String](…)` — or give the handler's parameter a type,
as the two-`catch` example above does. (A *handle* is the compiler's word for the implementation a
piece of code was handed; see [Implementations and `with`]({{ '/docs/implementations/' | relative_url }}).)

> **In one sentence.** A discharger is a function that hands the code you give it an implementation
> of its own; it runs your computation with it and returns a plain value, so the effect never
> reaches your signature — and you write the computation as its argument.
{: .tip}

Next: what happens when several effects meet —
[Combining and ordering effects]({{ '/docs/combining-effects/' | relative_url }}).
