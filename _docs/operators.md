---
title: Operators and fixity
nav_title: Operators & fixity
order: 9
part: Core language
summary: Naming definitions with operator symbols, and declaring their fixity and precedence as a partial order.
---

Operators in Eliot aren't a special language feature — they're ordinary definitions with symbolic
names. `+`, `&&`, and `.` are all just `def`s. That means you can define your own, and you control
exactly how they parse.
{: .docs-lead}

## An operator is just a def

Give a `def` a symbolic name and declare its fixity, and you have an infix operator. Here is the whole
of `Operators.els`:

```eliot
import eliot.effect.Console

def main: {Console} Unit = printLine(content(Cell("Hello") | Cell("World") | Cell("!")))

data Cell(content: String)

infix left
def |(lhs: Cell, rhs: Cell): Cell = rhs
```

`|` is a normal function of two `Cell`s; the `infix left` line makes it usable between its operands
and left-associative, so `Cell("Hello") | Cell("World") | Cell("!")` parses as
`(Cell("Hello") | Cell("World")) | Cell("!")`. This particular `|` just keeps its right operand, so
the program prints `!`.

Operator names are built from the symbol characters `! # $ % & * + . / < = > ? @ \ ^ | - ~ ;`. A few
combinations are reserved by the grammar (`(` `)` `[` `]` `{` `}` `,` `->` `_` `::` `:` `~` `&` `=`),
but otherwise you're free — `|>`, `<=>`, `++` are all valid names.

## Fixity and associativity

The fixity declaration goes **before** `def`, either on the same line or the line above:

- `infix` — used between two operands. Associativity is `left` (the default), `right`, or `none`.
- `prefix` — used before one operand, like `!` for boolean negation.
- `postfix` — used after one operand.

```eliot
prefix def !(a: Bool): Bool          // prefix: !flag
infix right def ::(head: A, tail: List): List   // right-associative: a :: b :: c = a :: (b :: c)
```

## Precedence is a partial order

Here's where Eliot differs from most languages. Instead of every operator getting a number on a
single precedence ladder, you declare precedence **relative to other operators** — and only where it
matters. The prelude's arithmetic is the model:

```eliot
infix left
def +[T ~ Numeric[T]](left: T, right: T): T = add(left, right)

infix left at +
def -[T ~ Numeric[T]](left: T, right: T): T = subtract(left, right)

infix left above +
def *[T ~ Numeric[T]](left: T, right: T): T = multiply(left, right)
```

Read the fixity lines: `-` sits **`at +`** (same precedence), and `*` sits **`above +`** (binds
tighter). That's why `2 + 3 * 4` is `2 + (3 * 4)`. You can also say `below X`, and combine several
relations (`below apply above (*, /)`).

`apply` — ordinary function application — is the top of the order. You can't bind tighter than it, so
the idiom `below apply` means "binds as tightly as possible short of a plain call" (that's how the dot
operator is declared).

> **Unrelated operators can't share an expression.** If two operators have *no* declared precedence
> relation between them, writing them together — `a ? b # c` — is a **compile error**, not a silent
> guess. Relate them explicitly, or parenthesize. This is deliberate: it removes the "I can never
> remember the precedence table" class of bugs.
{: .warn}

## Alphanumeric operators

Fixity isn't limited to symbols — an ordinary name can be infix too. From `HandleWith.els`:

```eliot
import eliot.effect.Console

infix def or(s1: String, s2: String): String = s1

def main: {Console} Unit = printLine(something(Else) or greet(Goodbye))
```

`or` reads as an infix word between its operands. You've already been using prelude examples of this:
the `else` that pairs with `if`, and the `catch` that recovers a `Throw`, are both infix operators —
which is why `parseBad catch (err -> err)` reads the way it does.

Operators are a small feature with a big payoff: the effect-discharge combinators (`else`, `catch`,
`orElse`) are all just infix `def`s, so the language's most powerful machinery reads like plain
English rather than nested function calls. Next, the operator that shapes Eliot style more than any
other: the dot.
