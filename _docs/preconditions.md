---
title: "Preconditions: demanding what is known"
nav_title: Preconditions
order: 17
part: Meta-information
summary: Demanding a fact about an argument with a parameter brace or a where clause, how every call proves it at compile time, and how to read the errors.
---

A precondition is a demand on meta-information. A function says what must be known about its
argument, and every call has to prove it before the program compiles. There are two spellings: a
**brace** after a parameter's type, for a bound, and a **`where`** clause, for any predicate at all.
{: .docs-lead}

## A bound on a parameter

A brace written after a parameter's type states the meta-information the argument must have:

```eliot
def setDuty(level: Int {closed(0, 255)}): Int = level
```

Read it as *"`level` is an `Int`, and its range lies within `0..255`."* The brace holds the
parameter's meta, built with the interval constructors:

| In the brace | Means the range lies within |
|---|---|
| `closed(0, 255)` | `0..255` |
| `atLeast(1)` | `1` and above, with no upper limit |
| `atMost(9)` | `9` and below, with no lower limit |

A negative bound is a subtraction, since Eliot has no negative literals: `closed(0 - 128, 127)`.

**Every call proves its argument fits.** The compiler compares the argument's range with the stated
one, at the call:

```eliot
setDuty(128)                // 128..128 lies within 0..255: compiles
setDuty(percentToDuty(50))  // 155..155: compiles
setDuty(300)                // does not compile
```

```text
error: The argument's meta-information Int$Meta(Interval(Bounded(300), Bounded(300))) does not fit Int$Meta(Interval(Bounded(0), Bounded(255))), which the parameter 'level' of 'Probe::setDuty' states.
```

The message spells metas the way the compiler stores them. `Int$Meta(…)` is an `Int`'s meta, and
`Interval(Bounded(300), Bounded(300))` is the range `300..300`. An end with no limit is
`Unbounded`, so `atLeast(1)` reads `Interval(Bounded(1), Unbounded)`.

**Inside the function, you can rely on it.** Every call that reaches `setDuty`'s body has already
proven that `level` lies in `0..255`. And the check costs nothing at runtime: there is no `if`, no
exception and no instruction, because no question is left to ask.

## Any predicate, with `where`

A brace says *"lies within this interval"*. For anything else, write a `where` clause: a condition
over the parameters' metas that must hold at every call.

```eliot
def isByte(i: Interval[BigInteger]): Bool = rangeWithin[0, 255](i)

def mix(a: Int, b: Int) where isByte(range(a) + range(b)): Int = a + b

mix(100, 100)   // the ranges add up to 200..200: compiles
mix(200, 100)   // 300..300: does not compile
```

```text
error: The precondition of 'Probe::mix' is not satisfied by the argument's meta-information.
```

How to read and write one:

- **It sits after the parameters, before the colon**, and before a `uses` clause if there is one:
  `def log(level: Int) where isByte(range(level)) uses Console: Unit`. That keeps the result side,
  `uses Console: Unit`, together.
- **Inside it, a parameter stands for its meta.** `range(a)` is `a`'s range, an
  `Interval[BigInteger]`, and `length(s)` is a string's length. Intervals add and subtract, so
  `range(a) + range(b)` is the range of the sum. In a `where`, `length(s)` is the slot, an
  interval, not the function that counts the characters at runtime.
- **It is ordinary Eliot code**, which the compiler runs at compile time. It can call your own
  functions, like `isByte` above, and combine conditions with `&&`:

  ```eliot
  def isDigit(i: Interval[BigInteger]): Bool = rangeWithin[0, 9](i)

  def cell(row: Int, column: Int) where isDigit(range(row)) && isDigit(range(column)): Int =
     row * 10 + column
  ```

- **`rangeWithin[Lo, Hi](i)`** is the standard test: `true` when the interval `i` lies within
  `Lo..Hi`. An interval open at either end never does. Its bounds go in brackets because a number in
  brackets is a compile-time number, the same kind a range is made of. In a brace,
  `closed(0, 255)` takes them directly.

**Which one to use?** A brace when the demand is a bound on one parameter: it reads as part of the
parameter, and callers see the contract right in the signature. A `where` when the demand relates
several parameters, or is not an interval.

## Demands on a list

A list's meta has two slots, and a `where` can read both. `size(list)` is how many items it has,
and `item(list)` is what is known about every item:

```eliot
import eliot.collection.List
import eliot.lang.Reach

def isByte(i: Interval[BigInteger]): Bool = rangeWithin[0, 255](i)
def fewEnough(i: Interval[BigInteger]): Bool = rangeWithin[1, 64](i)

def playAll(duties: List[Int]) where fewEnough(size(duties)) && duties.item.forAll(m -> isByte(m.range)) uses Console: Unit =
   duties.foreach(d -> printLine("duty " ++ show(d)))
```

`playAll(append(append(empty, 20), 200))` compiles. `playAll(append(empty, 300))` does not, because
an item does not fit a byte, and `playAll(empty)` does not, because the list has no item.

The items are read with **`forAll`**, from `eliot.lang.Reach`: *every item satisfies this*. It holds
of a list that has no item at all, the way "every item is a byte" is true of an empty list. That is
why `playAll` demands the size separately. Inside the lambda, `m` is one item's meta, so `m.range` is
its range.

## Checked where it is used

A precondition is checked against what your program actually passes, all the way from `main`. A
function that only passes its parameter on needs no precondition of its own:

```eliot
def half(x: Int): Int = setDuty(x)
def twice(z: Int): Int = half(z + z)

def main uses Console: Unit = {
   printLine(show(half(42)))      // compiles: 42 fits
   printLine(show(twice(200)))    // does not compile
}
```

`half` compiles as it is. Each call to it is checked with what that call passes, so `half(42)` is
fine and `twice(200)` is not. The error is reported at the call you wrote, with one line per
function the value went through, and what it was at each step:

```text
error: The argument's meta-information Int$Meta(Interval(Bounded(400), Bounded(400))) does not fit Int$Meta(Interval(Bounded(0), Bounded(255))), which the parameter 'level' of 'Probe::setDuty' states.
  |  In 'Probe::half' at Probe.els:3:25, where 'x' is Int$Meta(Interval(Bounded(400), Bounded(400))).
  |  In 'Probe::twice' at Probe.els:5:26, where 'z' is Int$Meta(Interval(Bounded(200), Bounded(200))).
```

This is a deliberate choice. Eliot does not ask you to prove `half` correct for *every* `Int` it
could be given. It proves it correct for every `Int` your program *does* give it, and rejects the
program if any of those is wrong. The price is that a demand deep inside a library can surface at
your call. The trace is there to show you why.

## When a call does not compile

There are three errors, and each has its own fix.

**"…does not fit…" or "…is not satisfied…"**: the compiler knows the argument's meta, and it is
too wide. Read the meta in the message, then look for the arithmetic or the branch that widened it:
a `match` arm returning too much, or a value used twice that the compiler cannot tell is the same.

**"Cannot prove what … states: the argument's meta-information is not known here"**: the compiler
stopped following the value before it reached the call. The
[previous chapter]({{ '/docs/following-values/' | relative_url }}#where-the-compiler-stops) lists
where that happens. The usual fix is to keep the value flowing as a plain `Int` from where it is
made to where it is demanded, or to keep it in a field that states its range
([Refined types of your own]({{ '/docs/refined-types/' | relative_url }})). When the value comes
from input, check it in a function that states what it returns
([next chapter]({{ '/docs/refining/' | relative_url }})).

**"…cannot be passed as a value"**: a function with a brace or a `where` can only be called with all
its arguments.

```text
error: A def stating meta-information on a parameter ('Probe::setDuty') cannot be passed as a value.
  |  Call it directly with all its arguments so what it states is checked at the use site.
```

Passed to `applyTo(setDuty, 10)`, the call would happen somewhere the compiler does not see as a call
to `setDuty`, and the demand could slip through, so it is refused. Wrapping it in a lambda,
`applyTo(x -> setDuty(x), 10)`, does not help today: the compiler does not follow a lambda's
parameter, so the demand inside fails as *cannot prove*. Call it directly.

## Where a brace may go

A brace in a signature means one of two things, depending on where it stands. After something a
function *receives*, it is a **demand**, and whoever supplies the value proves it. After what a
function *returns*, it is a **statement**, and the compiler takes it as written:

| Where | Means | Who answers for it |
|---|---|---|
| after a value parameter's type | a demand | every caller proves it (this chapter) |
| after a `data` field's type | a demand | every construction proves it ([Refined types of your own]({{ '/docs/refined-types/' | relative_url }})) |
| after a function's result type | a statement | you do: nothing checks it ([Refining a result]({{ '/docs/refining/' | relative_url }})) |
| after a constructor's fields, on a `data` type with slots | a statement | you do ([Meta-information of your own]({{ '/docs/custom-metas/' | relative_url }})) |

A brace does not go on a `uses` parameter: that argument is code the caller wrote, not a value.

Next: [Refining a result]({{ '/docs/refining/' | relative_url }}).
