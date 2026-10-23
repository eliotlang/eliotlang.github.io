---
title: "Refining: saying what you know"
nav_title: Refining a result
order: 18
part: Meta-information
summary: Stating what a function's result is known to be, with a brace after its result type — how a checked input becomes a value a precondition accepts, why the compiler trusts the statement, and what a wrong one costs.
---

The compiler works out what it can by following values. Some facts it cannot follow, because they
come from what a condition *means*. You know them, so you can state them: a brace after a
function's result type says what the result is known to be, and the compiler uses it in place of
what it derived. This is called **refining** the result.
{: .docs-lead}

## What the compiler cannot learn

Take the function from [Branching]({{ '/docs/branching/' | relative_url }}):

```eliot
def requirePositive(n: Int) uses Abort: Int = if(n > 0) n
```

You can see that whatever it returns is positive: when `n` is not, it aborts instead. The compiler
cannot. It follows *values*, and the value `requirePositive` returns is `n`, unchanged. The
condition only decides *whether* it returns. So if `n` is a number parsed from input, known to be
anything at all, the result is known to be anything at all too, and a precondition demanding a
positive number rejects it.

## State it

Write what you know in a brace after the result type:

```eliot
def requirePositive(n: Int) uses Abort: Int {atLeast(1)} = if(n > 0) n
```

Read the brace as *"the result is at least 1"*. It is the same vocabulary as a parameter brace
(`closed`, `atLeast`, `atMost`), but it points the other way. A parameter brace *demands* something
of what a caller passes. A result brace *states* something about what the function returns, and
every call of `requirePositive` now has a result known to be at least 1.

A brace may read the metas of the parameters, the way a `where` does. That lets a statement be as
precise as the function's own logic:

```eliot
def requirePositive(n: Int) uses Abort: Int {interval(Bounded(1), end(range(n)))} = if(n > 0) n
```

This one says *"at least 1, and no more than `n` could have been"*. `interval` builds a range from its
two ends, `Bounded(1)` is a lower end of 1, and `end(range(n))` is the upper end of `n`'s range,
whatever that is at this call. So `requirePositive(200)` is `1..200`, where `{atLeast(1)}` would have
forgotten the 200.

## Checked input becomes a value a precondition accepts

The [chapter on following values]({{ '/docs/following-values/' | relative_url }}#where-the-compiler-stops)
ended on a problem: a number read at runtime is unbounded, and nothing the compiler follows narrows
it. Refining solves it. Check the number once, in a function that states what passing the check
means:

```eliot
import eliot.effect.Console

def toByte(n: Int) uses Abort: Int {closed(0, 255)} = if(n >= 0 && n <= 255) n

def setDuty(level: Int {closed(0, 255)}) uses Console: Unit = printLine("duty " ++ show(level))

def main uses Console: Unit = {
   val requested = parseInt(readLine orElse "") else 0
   setDuty(toByte(requested) else 0)
}
```

`requested` could be any number. `toByte(requested)` is known to fit a byte, because its brace says
so, and when the check fails it aborts and `else 0` supplies a byte instead. `setDuty`'s precondition
holds, and the program compiles. Typed `128`, it prints `duty 128`. Typed `300`, it prints `duty 0`.

Put this way, refining is how a precondition reaches input: the check runs once, where the value
enters the program, and from there on the compiler knows what it proved.

## The brace replaces what the compiler derived

When a function has a brace on its result, the compiler uses the brace and **not** what it would
have derived. That cuts both ways:

- **A narrower brace adds what the compiler could not see**, as in `toByte`.
- **A wider brace throws away what it could see.** With `def widened(x: Int): Int {closed(0, 1000)} = x`,
  `widened(5)` is known to be `0..1000`, not `5..5`. Usually that is a mistake. Occasionally it is the
  point: the brace is now the function's promise, and callers cannot come to rely on more than it.

Only the result's meta is replaced. Everything else about the call is still followed through the
body: what it writes into a `State`, what it raises, and whether it can return at all. A function
that never returns still never returns, whatever its brace says.

A brace states the meta of a result whose type declares slots: an `Int`, a `String`, a `List`. A
brace on a function that returns a function, or a type with nothing to state, is an error. So,
today, is one on a function returning a `data` type: refining the slots of a `data` type of your own
([Meta-information of your own]({{ '/docs/custom-metas/' | relative_url }})) from a function's result
is planned but not in the compiler yet.

## The compiler trusts you

**Nothing checks a result brace.** Not against what the compiler derived, not at runtime, not in
tests. The compiler takes it as written, exactly as it takes the statements the platform's own
primitives make about their results. That is what makes it useful: it can say what the compiler
cannot work out. It is also its price.

A wrong brace is not a compile error. It is a wrong program. The backend chooses how to store each
value from what it knows about it, so a brace that is too narrow can make a value be stored in fewer
bits than it needs:

```eliot
def lie(x: Int): Int {closed(0, 10)} = x
```

What `lie(300)` then is depends on what reads it. With today's JVM backend, printing `lie(300)`
directly shows `300`, but printing `add(lie(300), 0)` shows `44`: the addition was done in a byte,
because its result was "known" to be at most 10. Neither result is something to rely on.

So refine the way you would write any other promise:

- **Let the brace say exactly what the body checks.** `toByte` checks `0..255` and states `0..255`.
  Keep the check and the statement in one small function, next to each other, so that a reader sees
  both at once.
- **Refine where a value enters the program**, as `toByte` does, and let the compiler follow it from
  there. A brace on every function is a brace that is wrong somewhere.
- **Prefer what the compiler derives.** A function that only computes needs no brace. Its result is
  derived exactly, and stays right when the function changes.
- **When in doubt, state less.** A wide statement can only make a precondition fail to compile. A
  wrong narrow one compiles.

## A few useful refinements

A brace that clamps, for a value that must stay in range whatever the arithmetic does:

```eliot
def clampByte(x: Int): Int {closed(0, 255)} = if(x > 255) 255 else if(x < 0) 0 else x
```

A brace that says what a fold cannot. The standard library counts a list's items with a fold, so
`list.size` is only known to be *at least 0*, although the list's own `size` slot is exact. A
function that returns the count can say that it *is* the size:

```eliot
import eliot.collection.List

def count[A](list: List[A]): Int {size(list)} = list.size
```

`count(append(append(empty, 3), 7))` is `2..2`. In the brace, `size(list)` is the list's slot,
the interval the compiler knows, not the counting function.

Refinements are ordinary functions, so they can be passed around like any other: `applyTo(clampByte, 500)`
is known to fit a byte.

## What a brace cannot read yet

A brace reads the metas of a function's value parameters. It cannot yet read what a `uses`
parameter's code returns: `def run(a uses *: Int) uses *: Int {range(a)} = a` compiles, but its result
is *not known*, so a precondition on it fails with *"cannot prove"*. That is a limit of today's
compiler, and like every such limit it fails to compile rather than passing.

Next: [Refined types of your own]({{ '/docs/refined-types/' | relative_url }}), where a fact is put
into a `data` type so that it travels with the value.
