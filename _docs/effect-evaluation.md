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
import eliot.carrier.Effect

def pick[A](left: {Effect} A, right: {Effect} A, flag: Bool): {Effect} A = fold(flag, left, right)

def main: {Console} Unit = pick(printLine("left ran"), printLine("right ran"), true)
```

```text
left ran
```

`{Effect} A` in a parameter position means *"a value, or a computation producing one"*. The argument
arrives **unrun**, and it is up to `pick` whether, when, and how often it runs. The declaration is
the whole difference between the two programs above — the call sites are identical.

Note the import: `{Effect}` is the one place ordinary code touches `eliot.carrier`. It names "the
effects of whoever calls me", so `pick` is exactly as effectful as the arm it selects. When the
suspended parameter's effects are known up front you can spell them concretely instead —
`whenTrue: {Console} A` — and no import is needed.

> **A row accepts a plain value too.** The empty set is a legal row, so a pure argument fits a
> `{Effect} A` slot and is lifted for you: `pick("just a string", readLine, flag)` type-checks.
> A row parameter says *"value or computation"*; it never forces the caller to produce an effect.
{: .note}

## Reading the rule off the standard library

Every laziness-requiring function in the standard library declares it, so the signatures tell you
what runs:

```eliot
def fold[A](condition: Bool, whenTrue: {Effect} A, whenFalse: {Effect} A): {Effect} A
def if[T](condition: Bool, value: {Abort} T): {Abort} T
def else[G[_] ~ Effect, A](computation: {Abort | G} A, fallback: {Effect} A): G[A]
def foreach[A](action: A => {Effect} Unit, list: List[A]): {Effect} Unit
```

- `fold`'s two arms are suspended, so **only the selected branch runs** — which is what makes
  `if..else` behave like the conditional you expect, since `if(c, v)` is just `fold(c, v, abort)`.
- `else`'s `fallback` is suspended, so it costs nothing when the computation succeeds.
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

The third rule is what makes the first two trustworthy: **an effect passes through a position only
if that position declares it.** A plain type parameter — `A`, `B`, `T` — is a *payload*. It stands
for a value, and it can never stand for an unrun computation.

So a function that transports effects has to say so. Compare:

```eliot
def use[A, B](a: A, f: A => B): B                        // transports nothing
def .[A, B](a: A, f: A => {Effect} B): {Effect} B        // the real dot operator
```

The dot operator's *function* slot declares a row, so `names.foreach(…)` and `lines.foldLeft(…)`
carry your effects through the chain. Its *subject* slot does not, so the subject must be a plain
value. Handing it a computation is a compile error that names the fix:

```eliot
def bad: Pair[String, String] = swap("second").runStateToPair("first")
```

```text
error: This argument is a computation, but argument 1 of '.' declares no effect row.
  A type parameter that declares no effect row is a payload: it can never stand for a computation.
  Call the function directly instead of routing the computation through this position, for example
  'runStateToPair(initial, program)' rather than 'program.runStateToPair(initial)'.
```

Which gives the practical rule for everyday code:

> **Call dischargers directly; don't dot-chain them.** Write
> `runStateToPair("first", swap("second"))`, `runThrow(parse(raw))`, `runAbort(lookup(key))`. A
> discharger takes an unrun computation at a parameter declared for it, and the dot's subject slot
> is not such a parameter. The **infix** dischargers are unaffected — `x catch (err -> …)` and
> `host else "localhost"` already resolve to a direct call.
{: .warn}

Everything else dot-chains as before: `names.foreach(…)`, `outcome.second`, `option.foldOption(…)`.
The restriction is narrow, it is always reported at the offending argument, and the error tells you
the direct-call spelling.

## Why the rules are worth the one restriction

The alternative — which Eliot did try — is to let the compiler decide per call site whether an
argument runs, inferring it from how generic the callee happens to be. That accepts
`swap("x").runStateToPair("y")`, and it costs you the ability to read evaluation order from a
signature at all: the same argument at the same slot could run, or not, depending on what a
*sibling* argument's type turned out to be.

The three rules replace that with something you can hold in your head:

| The slot's declared type | What happens to your argument |
|---|---|
| a plain type (`String`, `A`, `Rect`) | runs here, once, before the call |
| a row (`{Effect} A`, `{Abort} T`, `{Console} Unit`) | passed unrun; the callee decides |
| an arrow with a row in its codomain (`A => {Effect} B`) | your lambda's body runs when the callee applies it |

Three shapes, no inference, no per-function folklore.

## In practice

Most days none of this comes up: you write direct-style code, arguments run where you wrote them,
and the standard library's lazy combinators are already declared correctly. The rules matter when
you **write a combinator of your own** that must not run an argument — declare the row — and when
you **discharge an effect** — call the discharger directly.

Next: the effects that ship with the language —
[the effect catalogue]({{ '/docs/effect-catalogue/' | relative_url }}).
