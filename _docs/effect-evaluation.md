---
title: When effects run
nav_title: When effects run
order: 17
part: Effects
summary: A parameter's type decides whether it takes a value or an unrun computation; and an effect is always provided where it is written, wherever it ends up running.
---

Direct style hides the plumbing, not the semantics. Two questions follow naturally from the last
chapter: given an effectful expression, **when does it run** — and **who provides the effect it
performs**? Each has one rule, read off declarations you can see, and neither rule has exceptions.
{: .docs-lead}

## Rule 1 — the parameter decides: a value, or a computation

A parameter with a plain type takes a **value**. A parameter whose type carries an effect row takes a
**computation**. That is the whole evaluation rule; everything below is what it looks like.

### A plain type takes a value

A value is computed before the call, once, left to right — exactly as in Java, Python or C:

```eliot
def choose[A](left: A, right: A, flag: Bool): A = fold(flag, left, right)

def main: {Console} Unit = choose(printLine("left ran"), printLine("right ran"), true)
```

```text
left ran
right ran
```

Both arguments ran, even though `choose` uses only one of them: its parameters ask for values, so the
values were computed before `choose` started. A generic `A` is a plain type like any other, so you never
have to know how generic a function is to know whether your argument runs. A function type is plain
too: the argument `s -> printLine(s)` is a function value, and its *body* runs each time the callee
applies it.

### A row takes a computation

A parameter that must not run its argument up front — the untaken branch of a conditional, a fallback
that should only apply on failure, a step a loop repeats — declares a **row** on its type:

```eliot
def pick[A](left: {} A, right: {} A, flag: Bool): A = fold(flag, left, right)

def main: {Console} Unit = pick(printLine("left ran"), printLine("right ran"), true)
```

```text
left ran
```

`{} A` reads *"a computation producing an `A`"*. The argument arrives **unrun**, and the function
decides whether, when and how many times it runs:

```eliot
def twice(action: {} Unit): Unit = {
   action
   action
}

def main: {Console} Unit = twice(printLine("hello"))
```

```text
hello
hello
```

The declaration is the whole difference between `choose` and `pick` — the call sites are identical.

> **A row accepts a plain value too.** A pure expression is a computation that happens to perform
> nothing, so it fits a `{} A` slot: `pick("just a string", readLine orElse "", flag)` type-checks.
> A row parameter says *"may be delayed"*; it never forces the caller to produce an effect.
{: .note}

A `data` field follows the same rule: a field with a row stores a computation, and building the value
does not run it
([storing a computation]({{ '/docs/implementations/' | relative_url }}#storing-a-computation-in-a-data-field)).

## Rule 2 — an effect is provided where it is written

Rule 1 says *when* an effect runs. Who provides it — which implementation it runs on — never depends on
that. Every effectful call takes its implementation from the code around the place **you wrote it**:

- a [`with`]({{ '/docs/implementations/' | relative_url }}#choosing-a-different-implementation-with)
  around it, or a parameter it is written in whose row provides that effect (see below) — whichever
  is nearer;
- otherwise, the row of the function you wrote it in — which means that function's **caller** provides
  it, and so on up to `main`, where the platform does.

Handing your code to someone else to run does not change this:

```eliot
implement recordingConsole: Console {
   def printLine(s: String): {Writer[String]} Unit = tell(s ++ ";")
   def readLine: Option[String] = None
}

def recorded: String = runWriterToLog(twice(printLine("x")) with recordingConsole)
```

`recorded` is `"x;x;"`. The `printLine("x")` runs inside `twice`, twice, but it was *written* inside
the `with`, so both lines go to the recording console. A lambda is no different: its body is code you
wrote, so its effects are provided where the lambda is written, however often the callee applies it.

### A row says who provides

So a row never says *where* an effect runs. It says **who provides it**, and that depends only on where
the row stands:

- **On a function's result**, `def greet: {Console} Unit`: the **caller** provides `Console` — by
  declaring it in turn, by binding one with `with`, or by handling it.
- **On a parameter**, `computation: {Throw[E]} A`: **the function** provides each effect listed there
  that its own result row does not list. That is all a
  [discharger]({{ '/docs/discharging-effects/' | relative_url }}) is — `catch` provides `Throw[E]` to its
  computation by installing the handler a `raise` exits to. An entry the result row *does* list is
  passed on to the function's own caller: `if(condition, value: {Abort} T): {Abort} T` hands `value`'s
  `Abort` up.
- **`{}`** lists nothing, so the function provides nothing: every effect in the argument is still
  provided by you. `twice` above cannot see or replace the console its argument uses.

## Reading the rules off the standard library

Every function in the standard library that delays an argument declares it, so the signatures tell you
what runs, and who handles what:

```eliot
def fold[A](condition: Bool, whenTrue: {} A, whenFalse: {} A): A
def if[T](condition: Bool, value: {Abort} T): {Abort} T
def else[A](computation: {Abort} A, fallback: {} A): A
def foreach[A](action: A => {} Unit, list: List[A]): Unit
```

- `fold`'s two arms are computations, so **only the selected branch runs** — which is what makes
  `if..else` behave like the conditional you expect, since `if(c, v)` is just `fold(c, v, abort)`. Both
  arms are `{}`, so whatever the selected arm performs is yours to provide.
- `if` lists `Abort` in its own result row, so `value`'s `Abort` is passed on to `if`'s caller.
- `else`'s `computation` names `Abort`, which `else` itself does not declare — so `else` provides it,
  and handles it. Its `fallback` is a computation too, so it costs nothing when the computation
  succeeds.
- `foreach`'s `action` is a function, so `foreach` decides how often its body runs — once per element —
  while the lambda's effects are provided where you wrote it. `foreach` is effectful exactly when the
  callback is:

```eliot
import eliot.collection.List

def names: List[String] = append(append(empty, "Ada"), "Grace")

def main: {Console} Unit = names.foreach(n -> printLine(n))
```

A function whose parameters carry no rows — `printLine`, `append`, your own `def area(r: Rect)` — takes
values only. That is the common case, and it needs no annotation.

## A dot chain carries values

Rule 1 has one consequence worth seeing once, because it hides behind an operator rather than a
function call. The [dot operator]({{ '/docs/dot-operator/' | relative_url }}) is an ordinary
definition:

```eliot
def .[A, B](a: A, f: A => {} B): B = f(a)
```

Its *subject* `a: A` has a plain type, so it takes a value: whatever the subject performs runs **before**
the dot. That is usually what you want — `readLine.foldOption("", s -> s)` reads a line, then folds it —
but it means a discharger cannot take its computation through the dot:

```eliot
def bad: Pair[String, String] = swap("second").runStateToPair("first")
```

```text
error: This value performs the effect 'State' but does not declare it;
       add it to its { ... } effect set.
```

`swap("second")` ran in `bad` itself, before `runStateToPair` was called, so by rule 2 the `State` it
performs is `bad`'s to provide — and `bad` declares nothing. The fix is to put the computation where the
discharger takes it unrun:

> **Hand dischargers their computation as an argument.** Write
> `runStateToPair("first", swap("second"))`, `runThrow(parse(raw))`, `runAbort(lookup(key))`. The
> **infix** dischargers are unaffected — in `x catch (err -> …)` and `host else "localhost"`, the
> left operand already *is* the discharger's parameter.
{: .warn}

Everything else dot-chains as before: `names.foreach(…)`, `outcome.second`, `option.foldOption(…)`.

## The rules on one page

| The parameter's type | It takes | Who provides the argument's effects |
|---|---|---|
| plain: `String`, `A`, `Rect` | a value, computed before the call | you |
| a function: `A => {} B` | a function value; its body runs each time it is applied | you |
| an empty row: `{} A` | a computation, run when the callee runs it — maybe never, maybe often | you |
| a row naming effects: `{Throw[E]} A` | a computation, run when the callee runs it | the callee, for each effect its own result row does not list; you, for the rest |

Two questions, two rules, both read off the declaration, and nothing inferred. The alternative — which
Eliot did try — is to let the compiler decide per call site whether an argument runs, from how generic
the callee happens to be. That costs you the ability to read evaluation order from a signature at all:
the same argument at the same slot could run, or not, depending on what a *sibling* argument's type
turned out to be.

## In practice

Most days none of this comes up: you write direct-style code, arguments run where you wrote them, your
caller provides what your row declares, and the standard library's delaying combinators are already
declared correctly. The rules matter when you **write a combinator of your own** that must not run an
argument — declare the row — and when you **discharge an effect** — hand the discharger its
computation as an argument.

Next: the effects that ship with the language —
[the effect catalogue]({{ '/docs/effect-catalogue/' | relative_url }}).
