---
title: Blocks and val
nav_title: Blocks & val
order: 4
part: Core language
summary: Grouping statements with { }, binding intermediate results with val, and the line-joining rules.
---

When a definition needs more than a single expression, its body becomes a **block**: a sequence of
steps in `{ }`, ending in a result. Blocks are also where `val` bindings live.
{: .docs-lead}

## The shape of a block

A block is a newline-separated sequence of statements that **ends in a result expression**:

```eliot
def area(width: Int, height: Int): Int = {
  val product = width * height
  product
}
```

Two things are happening:

- **`val product = …`** binds a name to the result of a step. A `val` is local to the block.
- **`product`** on the last line is the block's **result** — the value the whole block produces. The
  final line must be an *expression*, never a binding.

The value of a one-expression definition and a block are interchangeable; `area` could just as well
be written `def area(width: Int, height: Int): Int = width * height`. You reach for a block the
moment there's an intermediate result worth naming, or more than one step to perform.

## Typed bindings

A `val` can carry its own type annotation when you want to be explicit or pin something down:

```eliot
val product: Int = width * height
```

## Bare statements

Not every line in a block needs to bind a name. A line that is just an expression is a **statement**:
it is performed, and its result is discarded. For a pure value that's pointless, but for an
*effectful* step — printing a line, updating state — it's exactly right. Here is the shape (the
`{Console}` effect is covered in the [Effects]({{ '/docs/effects/' | relative_url }}) part; focus on
the structure):

```eliot
def announce(name: String): {Console} Unit = {
  printLine("starting up")     // a bare statement: performed, result discarded
  val greeting = greet(name)   // a val: result bound for later use
  printLine(greeting)          // another bare statement
}

def greet(name: String): String = name
```

## Sequencing falls out for free

Here is the quiet magic of blocks. A block **lowers to a tower of immediately-applied lambdas**, so
when the steps are effectful, their sequencing — the thing other languages spell with `flatMap`,
`do`, or `await` — happens automatically. You write the steps in order, as if they were ordinary
values, and the compiler threads them. That's why the effectful example above reads like plain
imperative code even though nothing mutates. We come back to this in depth once effects arrive.

## The rules that will trip you up

Blocks have a few sharp edges. Each corresponds to a compile error, so you'll meet them quickly:

- **A block must end in an expression, not a binding.** `{ val x = 1 }` is an error — there is no
  result. End with the value you mean to produce.
- **A `val` cannot reference itself.** `val x = f(x)` is rejected. (Recall from the
  [introduction]({{ '/docs/introduction/' | relative_url }}) that Eliot has no recursion — this is
  the same rule at the level of a single binding.)
- **A block cannot be empty.** `{ }` has nothing to produce.

## Line joining: multi-line expressions

Statements are separated by newlines, so how do you split one long expression across several lines?
Eliot merges lines around infix operators:

- A line that **starts** with an infix operator merges with the line above it. This is what makes
  multi-line dot chains work — a leading `.` continues the previous line:

  ```eliot
  def transformed: Box[String] = Box("Hello")
    .filter("Expr")
    .map(_ -> "Earth!")
    .as("World!")
  ```

- A line that **ends** with an infix operator merges with the line below it.
- A **blank line never merges** — it's a hard break between statements.
- A line never merges *into* a following `val` — a binding always starts fresh.

(The dot operator gets its own chapter; the point here is only that the chain above is a *single*
expression, split for readability, not four statements.)

With `def` and blocks in hand, you can write straight-line code. Next we add decisions — and Eliot's
surprising answer to "where is `if`?"
