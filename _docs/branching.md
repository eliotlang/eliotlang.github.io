---
title: "Branching: if is a function"
nav_title: Branching
order: 5
part: Core language
summary: Decisions are made with if..else, which is an ordinary library function rather than a keyword, and with match.
---

Branching in Eliot reads the way you'd expect: `if`, `else`, and `match`. What's different is that
`if` and `else` are **not keywords** — they are ordinary functions from the prelude, and nothing about
them is special to the compiler.
{: .docs-lead}

## `if..else`

```eliot
def classify(n: Int) uses Console: Unit =
  printLine(if(n > 0) "positive" else if(n < 0) "negative" else "zero")

def main uses Console: Unit = classify(42)
```

This prints `positive`. The condition goes in parentheses, the value follows it, and `else` supplies
the alternative. `else` binds **right-associatively**, so `if … else if … else …` chains nest exactly
the way you'd expect. Both branches must yield the same type.

## `if` is just a function

Here are the two signatures, straight from the standard library:

```eliot
def if[T](condition: Bool, value uses *, Abort: T) uses Abort: T
def else[A](computation uses *, Abort: A, fallback uses *: A): A
```

Everything about the familiar syntax falls out of ordinary rules:

- **The call syntax is currying.** Every function is curried, so `if(cond, value)` can equally be
  written `if(cond) value`. That's all `if(n > 0) "positive"` is: a two-argument call, spelled with
  the second argument after the parentheses.
- **`else` is an infix operator.** `x else y` is `else(x, y)` — any two-parameter function can be
  declared infix, and `else` is declared right-associative and loose-binding so chains need no
  parentheses.
- **The branches don't run early, because the signatures say so.** In most languages a function's
  arguments are evaluated before the call, which is exactly why `if` has to be built into the
  language there. In Eliot an argument also runs before the call — *unless the parameter takes
  code*, which it says with a `uses` clause of its own. `value uses *, Abort: T` and
  `fallback uses *: A` both do, so they arrive unrun, and only the branch that is selected ever runs.
  Laziness isn't a property of `if`; it's something any function can ask for in its signature.
  (The `Abort` in `value`'s clause lets the value abort too — a nested `if` without its own `else` —
  and that joins the same `Abort` as the `if` around it.)
- **A false condition is an effect.** When the condition doesn't hold, `if` has no value to give, so
  it *aborts* — it performs the (ambient) `Abort` effect, which is why `if` declares `uses Abort`.
  `else` takes that possibly-aborting computation and *discharges* the `Abort` by providing the
  fallback, so its result is a plain `A`. When an `if..else` is complete, the `Abort` is fully
  handled and never appears in your function's signature: `classify` above declares only
  `uses Console`.

This is your first taste of introducing an effect and then discharging it; the
[Effects]({{ '/docs/effects/' | relative_url }}) part makes it precise. The practical upshot is that
there's nothing magic to learn: if you wanted a different control construct, you could write it
yourself with the same tools. The prelude does exactly that with `when` and `unless`, one-armed
siblings for statements that need no `else`:

```eliot
def warnIfEmpty(name: String) uses Console: Unit = when(name == "") printLine("no name given")
```

## Pure or effectful, it's the same `if..else`

An `if..else` is an expression like any other, so it works wherever a value is expected. As the body
of a pure function it just hands you back a plain value — no `uses` clause, no ceremony:

```eliot
def sign(n: Int): String = if(n > 0) "+" else "-"
```

Chains and intermediate `val` bindings read exactly the same way:

```eliot
def describe(a: Bool, b: Bool): String = {
  val category = if(a) "first" else if(b) "second" else "third"
  category
}
```

When the branches are effectful computations instead, only the taken branch is ever run:

```eliot
def greet(known: Bool, name: String) uses Console: Unit =
   if(known) printLine(name) else printLine("hello, stranger")
```

A bare `if` with **no** `else` doesn't discharge the `Abort` — it floats up to the caller, turning the
`if` into a guard. That follows directly from the signature, and it's occasionally what you want:

```eliot
def requirePositive(n: Int) uses Abort: Int = if(n > 0) n
```

Most of the time, though, you write the `else`.

## Boolean operators

Conditions are built with the usual comparisons (`>`, `<`, `>=`, `<=`, `==`) and logical operators
`&&`, `||`, and `!` — all in the prelude, no import needed. They group the way you're used to: `&&`
binds tighter than `||`, so `a || b && c` means `a || (b && c)`. One difference to keep in mind:
there is no short-circuiting. `&&` and `||` are ordinary functions over already-computed `Bool`
values, so both operands always evaluate.

## `match`: branching on shape

For anything richer than a yes/no condition — taking apart a data type, handling each case of a sum —
you use `match`. It gets its own chapter next, since it goes hand in hand with defining data. Here is
a taste:

```eliot
def describe(m: Maybe[String]): String = m match {
  case Nothing -> "empty"
  case Just(v) -> v
}
```

The rule of thumb: reach for `if..else` for a `Bool` decision and `match` when you're distinguishing
the *constructors* of a value. Neither is magic control flow hiding underneath — which is exactly what
keeps Eliot programs analyzable.

Next: defining your own data types, and taking them apart with `match`.
