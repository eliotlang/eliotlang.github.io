---
title: "Values and code: when effects run"
nav_title: Values & code
order: 20
part: Effects
summary: Effects run where they are written; a parameter that takes code instead of a value says so with uses; a parameter without uses is a value, pure even when it is a function; and a closed clause says what code may not do.
---

Direct style hides the plumbing, not the semantics. This chapter answers the question the last three
have been circling: given an expression, **when does each of its effects actually happen** — and how
do you tell without reading the callee's body?
{: .docs-lead}

There are three rules. They fit on one page, and together they make evaluation order something you
*read off a signature* rather than something you learn per function. The chapter builds them up one
at a time, then puts them in one table.

## Rule 1 — effects run where they are written

An effectful expression performs its effects at the point it appears. Arguments are evaluated
before the call, left to right, exactly as in any strict language:

```eliot
def choose[A](left: A, right: A, flag: Bool): A = fold(flag, left, right)

def main uses Console: Unit = choose(printLine("left ran"), printLine("right ran"), true)
```

```text
left ran
right ran
```

Both arguments ran, even though `choose` uses only one of them. That is not a wart — it is the same
thing that happens in Java, Python or C when you call `choose(f(), g())`. The effect is written at
the call site, so it happens at the call site, using the `Console` that is in scope there: `main`'s.

The value of this rule is that it holds *everywhere*, with no exception for generic code. You never
have to know how generic a function is to know whether your argument runs.

## Rule 2 — a parameter that takes code says so

Some functions genuinely need to *not* run an argument: the untaken branch of a conditional, a
fallback that should only apply on failure, a step a loop runs many times. Such a parameter takes
**code** rather than a value, and it says so with a `uses` clause of its own:

```eliot
def pick[A](left uses *: A, right uses *: A, flag: Bool): A = fold(flag, left, right)

def main uses Console: Unit = pick(printLine("left ran"), printLine("right ran"), true)
```

```text
left ran
```

`left uses *: A` reads *"code, written by my caller, that produces an `A`"*. The argument arrives
**unrun**, and it is up to `pick` whether, when, and how often it runs. The declaration is the whole
difference between the two programs above — the call sites are identical.

The `*` says which effects that code may use: **whatever is in scope where it is written**. The
`printLine` above is written inside `main`, so it uses `main`'s `Console` — wherever and whenever
`pick` ends up running it. That is why `pick` itself declares no `uses`: it performs nothing of its
own, any more than it would for a `flag` you passed it. The effects belong to the code you wrote,
and you declared them where you wrote it.

A code parameter may also list effects after the `*` — `computation uses *, Throw[E]: A`. Those
are effects the **callee gives** the code, on top of the caller's own: the callee runs it inside a
handler of its own. That is exactly what a
[discharger]({{ '/docs/discharging-effects/' | relative_url }}) is, and you have been using the rule
since the last two chapters.

> **A code parameter accepts a plain value too.** A pure expression is code that happens to use
> nothing, so `pick("just a string", readLine orElse "", flag)` type-checks. A `uses` parameter says
> *"may run later"*; it never forces the caller to write an effect.
{: .note}

### Reading the rule off the standard library

Every function in the standard library that must not run an argument declares it, so the signatures
tell you what runs:

```eliot
def fold[A](condition: Bool, whenTrue uses *: A, whenFalse uses *: A): A
def if[T](condition: Bool, value uses *, Abort: T) uses Abort: T
def else[A](computation uses *, Abort: A, fallback uses *: A): A
def foreach[A](action uses *: A => Unit, list: List[A]): Unit
```

- `fold`'s two arms are code, so **only the selected branch runs** — which is what makes
  `if..else` behave like the conditional you expect, since `if(c, v)` is just `fold(c, v, abort)`.
- `else`'s `computation` is given `Abort`, which `else` itself does not declare — so `else` handles
  it. Its `fallback` is code too, so it costs nothing when the computation succeeds.
- `foreach`'s `action` is code that takes an argument: your lambda, run once per element, using
  your effects. `foreach` declares no `uses`, and a call to it performs exactly what your lambda
  does:

```eliot
import eliot.collection.List

def names: List[String] = append(append(empty, "Ada"), "Grace")

def main uses Console: Unit = names.foreach(n -> printLine(n))
```

A function whose parameters carry no `uses` — `printLine`, `append`, your own `def area(r: Rect)` —
takes values: it runs each argument exactly once, right there. That is the common case, and it
needs no annotation.

## Rule 3 — a parameter without `uses` is a value

The third rule is what makes the first two trustworthy: **only a `uses` parameter takes code.** Every
other parameter — `A`, `String`, and a function type like `A => B` too — takes a *value*, and a
value is pure.

For a plain type that is rule 1 again: the argument runs before the call. For a function type it
means the function you pass must be a **pure function value**. A lambda written there may perform
and handle effects *inside itself*, but it cannot reach the effects around it:

```eliot
def use[A, B](a: A, f: A => B): B = f(a)

def main uses Console: Unit = use("hi", s -> printLine(s))
```

```text
error: This uses the effect 'Console' inside a function written where a value is expected.
```

`use`'s signature has no `uses` anywhere, and that is a promise: calling it performs nothing. If a
combinator should run its caller's effects, its parameter says so — `f uses *: A => B` — exactly as
`foreach` does.

The two kinds of parameter are treated differently in the callee too:

- **A value may be kept.** A pure function is harmless to store, return or compose:
  `def compose[A, B, C](f: B => C, g: A => B): A => C = a -> f(g(a))` is ordinary code.
- **Code is called or passed on, never kept.** A `uses` parameter can be run, or handed to another
  `uses` parameter, and nothing else. Storing one is an error — *"'f' is code its caller wrote: it
  can be called or passed on, not kept"* — because code that was given its effects by one call
  must not run after that call has returned, when the handler it relied on is gone.

### The dot operator shows both kinds

```eliot
def .[A, B](a: A, f uses *: A => B): B = f(a)
```

Its *function* slot takes code, so `names.foreach(…)` and `lines.foldLeft(…)` carry your effects
through the chain. Its *subject* slot is a value, so whatever the subject performs runs **before**
the dot, exactly as rule 1 says. That is usually what you want — `readLine.foldOption("", s -> s)`
reads a line, then folds it — but it is why a discharger cannot take its computation through the
dot:

```eliot
def bad: Pair[String, String] = swap("second").runStateToPair("first")
```

```text
error: This value performs the effect 'State' but does not declare it;
       add it to its `uses` clause.
```

`swap("second")` ran in `bad` itself, before `runStateToPair` was called, so the `State` it
performs is `bad`'s. This is the reason behind the one rule of the
[discharging chapter]({{ '/docs/discharging-effects/' | relative_url }}#the-one-rule-hand-the-discharger-its-computation):
hand a discharger its computation as an argument, where the parameter takes it as code.

## Closing a parameter

Leave the `*` out and the clause is **closed**: `body uses Throw[E]: A` takes code that may use
`Throw[E]`, which the callee gives it, and **nothing** from around it. Whatever else the argument
does, it has to handle itself:

```eliot
def runPure[E, A](body uses Throw[E]: A): Either[E, A] = runThrow(body)
```

`runPure(half(4))` is fine for a `half` that may raise; a `printLine` inside the argument is an
error at the `printLine` — *"This uses the effect 'Console' inside an argument whose `uses` clause
is closed"* — even when the caller could print. A closed clause is how a signature promises that
some code performs nothing but what it lists: "this test body does no I/O", say.

## The three rules in one table

| The parameter | What happens to your argument |
|---|---|
| no clause (`String`, `A`, `Rect`) | a value: runs here, once, before the call |
| no clause, a function type (`A => B`) | a pure function value: may use no effect from around it |
| `uses *` (`x uses *: A`, `f uses *: A => B`) | your code, passed unrun, using your effects; the callee decides when |
| `uses *, E` | the same, and the callee also gives it `E` — a discharger |
| `uses E`, no `*` | closed: code that may use `E` and nothing from around it |

One word, no inference, no per-function folklore. And it reads in both directions: **a signature
with no `uses` anywhere is pure** — it performs nothing, and it runs no code you hand it.

## Why the rules are worth it

The alternative — which Eliot did try — is to let the compiler decide per call site whether an
argument runs, inferring it from how generic the callee happens to be. That costs you the ability
to read evaluation order from a signature at all: the same argument at the same slot could run, or
not, depending on what a *sibling* argument's type turned out to be. The three rules replace that
with something you can hold in your head, and every decision is made from the declarations you can
see.

## In practice

Most days none of this comes up: you write direct-style code, arguments run where you wrote them,
and the standard library's lazy combinators are already declared correctly. The rules matter in two
situations — when you **write a combinator of your own** that must not run an argument (give the
parameter `uses *`), and when you **discharge an effect** (hand the discharger its computation as
an argument).

> **In one sentence.** A parameter without `uses` is a value, computed before the call and pure; a
> parameter with `uses` is your code, run by the callee on your effects, plus whatever the callee
> gives it; and leaving out the `*` closes the code to everything but what the clause lists.
{: .tip}

Next: the model beneath the `uses` clauses —
[Implementations and `with`]({{ '/docs/implementations/' | relative_url }}).
