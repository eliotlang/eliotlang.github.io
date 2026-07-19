---
title: Branching without if
nav_title: Branching
order: 5
part: Core language
summary: There is no if keyword. Decisions are made with fold, the if..else functions, and match.
---

Eliot has **no `if`/`then`/`else` keyword**. Branching is done with ordinary functions and with
`match`. Once you see how, it reads exactly like the imperative `if` you already know — but it's
built from smaller, more honest parts.
{: .docs-lead}

## `fold`: the primitive

The two-armed eliminator for `Bool` is `fold`. It takes a condition and two arms, and yields one of
them:

```eliot
import eliot.effect.Console

def label(active: Bool): String = fold(active, "ON", "OFF")

def main: {Console} Unit = printLine(label(true))
```

This prints `ON`. `fold` is part of the auto-imported prelude, so it needs no import. Two things to
know about it:

- **Both arms must have the same type.** `fold(active, "ON", "OFF")` is fine (both `String`); a `fold`
  mixing a `String` and an `Int` is a type error.
- **Pure arms are both evaluated.** `fold` *selects* between two values — it does not lazily skip the
  branch not taken. (When the arms are effectful *computations*, only the selected one is actually
  **run**, but you should never rely on a pure arm being skipped for correctness.)

Writing `fold` by hand everywhere gets tedious, so the prelude builds a familiar `if..else` directly
on top of it — that's what you'll reach for almost every time.

## `if..else`: the readable form

`if` is a function too — `if(condition, value)` yields `value` when the condition holds, and otherwise
**short-circuits**. The infix `else` supplies the alternative. Because everything is curried,
`if(cond, value)` can be written `if(cond) value`, which is what makes the classic spelling read
naturally:

```eliot
import eliot.effect.Console
import eliot.effect.Abort

def classify(n: Int): {Console} Unit =
  printLine(if(n > 0) "positive" else if(n < 0) "negative" else "zero")

def main: {Console} Unit = classify(42)
```

This prints `positive`. `else` binds **right-associatively**, so `if … else if … else …` chains nest
exactly the way you'd expect.

> **Why the `import eliot.effect.Abort`?** A bare `if` that doesn't match its condition short-circuits
> using the `Abort` effect, and the infix `else` is what *discharges* that effect by providing the
> fallback — so using `if..else` means importing `else` from `eliot.effect.Abort`. When an `if..else`
> is complete, the `Abort` is fully handled and never appears in your function's type: `classify` above
> declares only `{Console}`. This is your first taste of introducing an effect and then discharging
> it; the [Effects]({{ '/docs/effects/' | relative_url }}) part makes it precise.
{: .note}

## Pure or effectful, it's the same `if..else`

An `if..else` is an expression like any other, so it works wherever a value is expected. As the body
of a pure function it just hands you back a plain value — no effect row, no ceremony:

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
def greet(known: Bool, name: String): {Console} Unit =
   if(known) printLine(name) else printLine("hello, stranger")
```

A bare `if` with **no** `else` doesn't discharge the `Abort` — it floats up to the caller, turning the
`if` into a guard. That's occasionally what you want, but most of the time you write the `else`.

## `fold` or `if..else`?

Both compile down to the same eliminator, so the choice is only about fit:

- Reach for **`if..else`** by default. It reads like the `if` you already know, it chains, it guards,
  and it works the same in a pure function or an effectful one.
- Reach for **`fold`** when you already hold two ready-made values of the same type and simply want to
  select one. It's a plain function call — no `else`, and it never introduces `Abort` in the first
  place. The trade-off is that both arms must already share a type; `fold` won't lift a pure arm to
  meet an effectful one the way `if`'s arm does.

## Boolean operators

Conditions are built with the usual comparisons (`>`, `<`, `>=`, `<=`, `==`) and logical operators
`&&`, `||`, and `!` — all in the prelude, no import needed. One quirk to note:

> **`&&` and `||` have the *same* precedence.** Unlike most languages, `||` does not bind looser than
> `&&`. A mixed chain groups left-to-right, so `a || b && c` means `(a || b) && c`. When you mean
> `a || (b && c)`, add the parentheses. Also, both operands always evaluate — there is no
> short-circuiting, because they are ordinary functions over already-computed `Bool` values.
{: .warn}

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

The rule of thumb: reach for `if..else` for a `Bool` decision, `match` when you're distinguishing the
*constructors* of a value, and drop down to `fold` when you just want to pick between two ready-made
values. All three compile down to the same eliminators — there's no magic control flow hiding
underneath, which is exactly what keeps Eliot programs analyzable.

Next: defining your own data types, and taking them apart with `match`.
