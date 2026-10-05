---
title: When effects run
nav_title: When effects run
order: 17
part: Effects
summary: Effects run where they are written; a parameter that must not run its argument declares a row; and a plain type parameter can never hold a computation.
---

Direct style hides the plumbing, not the semantics. This chapter answers the question that follows
naturally from the last one: given an expression, **when does each of its effects actually happen** —
and how do you tell without reading the callee's body?
{: .docs-lead}

There are three rules. They fit on one page, and together they make evaluation order something you
*read* rather than something you *learn per function*.

## Rule 1 — effects run where they are written

An effectful expression performs its effects at the point it appears. Arguments are evaluated
before the call, left to right, exactly as in any strict language:

```eliot
def choose[A](left: A, right: A, flag: Bool): A = fold(flag, left, right)

def main: {Console} Unit = choose(printLine("left ran"), printLine("right ran"), true)
```

```text
left ran
right ran
```

Both arguments ran, even though `choose` uses only one of them. That is not a wart — it is the same
thing that happens in Java, Python or C when you call `choose(f(), g())`. The effect is written at
the call site, so it happens at the call site.

The value of this rule is that it holds *everywhere*, with no exception for generic code. You never
have to know how generic a function is to know whether your argument runs.

## Rule 2 — a parameter that must not run its argument says so

Some functions genuinely need to *not* run an argument: the untaken branch of a conditional, a
fallback that should only apply on failure, a step a loop runs many times. Those parameters declare
an **effect row** on their own type:

```eliot
def pick[A](left: {} A, right: {} A, flag: Bool): A = fold(flag, left, right)

def main: {Console} Unit = pick(printLine("left ran"), printLine("right ran"), true)
```

```text
left ran
```

`{} A` in a parameter position is the **empty row**: *"a computation producing an `A`, and I add
nothing to it"*. The argument arrives **unrun**, and it is up to `pick` whether, when, and how often it
runs. The declaration is the whole difference between the two programs above — the call sites are
identical.

Because the row is empty, `pick` neither performs nor handles anything itself: whatever the selected
arm performs — `Console` here — is the *caller's* effect, bound by the caller's declaration, and
`pick` is exactly as effectful as the arm it selects. Notice that `pick`'s own result is a plain `A`;
it declares no row because it performs nothing of its own.

A parameter may also name effects — `value: {Abort} T`, `computation: {Throw[E]} A`. An effect the
function's own row does not declare is one the function **handles** for its argument; that is what
makes a [discharger]({{ '/docs/discharging-effects/' | relative_url }}).

> **A row accepts a plain value too.** A pure expression is a computation that happens to perform
> nothing, so it fits a `{} A` slot: `pick("just a string", readLine orElse "", flag)` type-checks.
> A row parameter says *"may be suspended"*; it never forces the caller to produce an effect.
{: .note}

## Reading the rule off the standard library

Every laziness-requiring function in the standard library declares it, so the signatures tell you
what runs:

```eliot
def fold[A](condition: Bool, whenTrue: {} A, whenFalse: {} A): A
def if[T](condition: Bool, value: {Abort} T): {Abort} T
def else[A](computation: {Abort} A, fallback: {} A): A
def foreach[A](action: A => {} Unit, list: List[A]): Unit
```

- `fold`'s two arms are suspended, so **only the selected branch runs** — which is what makes
  `if..else` behave like the conditional you expect, since `if(c, v)` is just `fold(c, v, abort)`.
- `else`'s `computation` names `Abort`, which `else` itself does not declare — so `else` handles it.
  Its `fallback` is suspended, so it costs nothing when the computation succeeds.
- `foreach`'s `action` is an arrow whose *codomain* carries a row, so the callback may be effectful
  and `foreach` is effectful exactly when the callback is:

```eliot
import eliot.collection.List

def names: List[String] = append(append(empty, "Ada"), "Grace")

def main: {Console} Unit = names.foreach(n -> printLine(n))
```

A function whose parameters carry no rows — `printLine`, `append`, your own `def area(r: Rect)` —
runs each argument exactly once, right there. That is the common case, and it needs no annotation.

## Rule 3 — a plain type parameter is a value, never a computation

The third rule is what makes the first two trustworthy: **an effect passes into a position only if
that position declares a row.** A plain type parameter — `A`, `B`, `T` — is a *payload*. It stands
for a value, and it can never stand for an unrun computation.

So a function that transports effects has to say so. Compare:

```eliot
def use[A, B](a: A, f: A => B): B             // f's body may not reach the caller's effects
def .[A, B](a: A, f: A => {} B): B            // the real dot operator
```

The dot operator's *function* slot declares a row, so `names.foreach(…)` and `lines.foldLeft(…)`
carry your effects through the chain, bound by your declarations. Its *subject* slot does not, so
the subject is a plain value: whatever it performs runs **before** the dot, exactly as rule 1 says.
That is usually what you want — `readLine.foldOption("", s -> s)` reads a line, then folds it — but
it means a discharger cannot take its computation through the dot:

```eliot
def bad: Pair[String, String] = swap("second").runStateToPair("first")
```

```text
error: This value performs the effect 'State' but does not declare it;
       add it to its { ... } effect set.
```

`swap("second")` ran in `bad` itself, before `runStateToPair` was called, so the `State` it performs
is `bad`'s. The fix is to put the computation where the discharger can receive it unrun:

> **Hand dischargers their computation as an argument.** Write
> `runStateToPair("first", swap("second"))`, `runThrow(parse(raw))`, `runAbort(lookup(key))`. The
> **infix** dischargers are unaffected — in `x catch (err -> …)` and `host else "localhost"`, the
> left operand already *is* the discharger's parameter.
{: .warn}

Everything else dot-chains as before: `names.foreach(…)`, `outcome.second`, `option.foldOption(…)`.

The same rule covers lambdas. A lambda passed where the arrow's result declares no row — `use`'s
`f: A => B` above — may perform and handle effects *inside itself*, but cannot reach the effects its
enclosing function declares; anything it performs and does not handle is an error at the lambda.

## Why the rules are worth it

The alternative — which Eliot did try — is to let the compiler decide per call site whether an
argument runs, inferring it from how generic the callee happens to be. That costs you the ability to
read evaluation order from a signature at all: the same argument at the same slot could run, or not,
depending on what a *sibling* argument's type turned out to be.

The three rules replace that with something you can hold in your head:

| The slot's declared type | What happens to your argument |
|---|---|
| a plain type (`String`, `A`, `Rect`) | runs here, once, before the call |
| a row (`{} A`, `{Abort} T`, `{Throw[E]} A`) | passed unrun; the callee decides |
| an arrow with a row in its codomain (`A => {} B`) | your lambda's body runs when the callee applies it |

Three shapes, no inference, no per-function folklore.

## In practice

Most days none of this comes up: you write direct-style code, arguments run where you wrote them,
and the standard library's lazy combinators are already declared correctly. The rules matter when
you **write a combinator of your own** that must not run an argument — declare the row — and when
you **discharge an effect** — hand the discharger its computation as an argument.

Next: the effects that ship with the language —
[the effect catalogue]({{ '/docs/effect-catalogue/' | relative_url }}).
