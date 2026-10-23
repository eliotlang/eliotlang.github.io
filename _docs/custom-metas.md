---
title: Meta-information of your own
nav_title: Your own meta-information
order: 20
part: Meta-information
summary: Declaring a new kind of fact on your own data type — a domain with its Meta instance, a slot on the type, a statement on each constructor — and demanding it with where, exactly like a range.
---

Range, length and size are the kinds of meta-information the standard library declares. None of
them is built into the compiler, and a program can declare kinds of its own. You choose what is
known about a value of your `data` type, say how it follows from the fields, and the compiler
tracks it through your program and checks it exactly like a range.
{: .docs-lead}

## When you need one

A `where` reads metas, not values. In a `where`, a parameter stands for its meta, so `range(level)`
works and `t.celsius` does not: `t.celsius` is a field of the runtime value, and there is no runtime
value at compile time, only what is known about it. A `where` that reaches into a field is a type
error.

So when a precondition should be about a `data` value as a whole, the type needs a slot of its own
that says what is known about it. The rest of this chapter builds one, for a small heating
controller with a pump that must not run while its pipes may be frozen.

## Step 1: a domain

First decide *what* is known. Here, one thing: whether a temperature is above freezing, or might
not be. That is an ordinary `data` type:

```eliot
data Frost = AboveFreezing | MaybeFreezing
```

The compiler also needs to know how to combine two of them, for when a value can come from more
than one branch, and that is an instance of the `Meta` ability from `eliot.compiler.Meta`:

```eliot
import eliot.compiler.Meta

implement Meta[Frost] {
   def join(a: Frost, b: Frost): Frost = a match {
      case AboveFreezing -> b
      case MaybeFreezing -> MaybeFreezing
   }
   def widen(previous: Frost, next: Frost): Frost = join(previous, next)
}
```

- **`join`** says what is known of a value that is either `a` or `b`. If either one might be
  freezing, the value might be.
- **`widen`** is the same question for code that may run any number of times, such as a fold's
  function, and must stop changing when it is asked repeatedly. A `Frost` can change at most once,
  so joining is enough.

[Under the hood]({{ '/docs/meta-domains/' | relative_url }}) explains both in more detail. A type
with a `Meta` instance is a **domain**: something a slot can hold.

## Step 2: a slot, and what each constructor states

Declare the slot on the `data` type, in braces after its name, as `type Int` does. Then each
constructor says, in a brace after its fields, what its value's slot is:

```eliot
def frostOf(celsius: Interval[BigInteger]): Frost = fold(rangeWithin[1, 1000](celsius), AboveFreezing, MaybeFreezing)

data Temperature {frost: Frost}(celsius: Int) {frostOf(range(celsius))}
```

Read the last line as *"a `Temperature` has a field `celsius`, and the compiler knows a `frost` about
every `Temperature`, which is `frostOf` the range of its `celsius`."* In the constructor's brace a
field stands for its meta, as a parameter does in a `where`, so `range(celsius)` is the interval the
compiler knows for the `celsius` it was built with. `frostOf` is an ordinary function, which the
compiler runs at compile time, at every construction. `Temperature(18)` has `AboveFreezing`, and
`Temperature(0 - 3)` and `Temperature(0)` have `MaybeFreezing`.

## Step 3: demand it

A `where` reads the slot by its name, as it reads `range`:

```eliot
import eliot.effect.Console
import eliot.compiler.Meta

data Frost = AboveFreezing | MaybeFreezing

implement Meta[Frost] {
   def join(a: Frost, b: Frost): Frost = a match {
      case AboveFreezing -> b
      case MaybeFreezing -> MaybeFreezing
   }
   def widen(previous: Frost, next: Frost): Frost = join(previous, next)
}

def frostOf(celsius: Interval[BigInteger]): Frost = fold(rangeWithin[1, 1000](celsius), AboveFreezing, MaybeFreezing)

def isAboveFreezing(f: Frost): Bool = f match {
   case AboveFreezing -> true
   case MaybeFreezing -> false
}

data Temperature {frost: Frost}(celsius: Int) {frostOf(range(celsius))}

def startPump(t: Temperature) where isAboveFreezing(frost(t)) uses Console: Unit =
   printLine("pump on at " ++ show(t.celsius))

def warmest(morning: Bool): Temperature = if(morning) Temperature(4) else Temperature(12)

def main uses Console: Unit = {
   startPump(Temperature(18))
   startPump(warmest(true))
}
```

This compiles and prints `pump on at 18` and `pump on at 4`. `warmest` may return either of two
temperatures, so its `frost` is the `join` of both, and both are above freezing. Change `Temperature(4)`
to `Temperature(0)`, and `startPump(warmest(true))` no longer compiles:

```text
error: The precondition of 'Heating::startPump' is not satisfied by the argument's meta-information.
```

The slot travels like any meta: through your functions, into and out of other `data` values, joined
at every branch with your `join`, and widened in every loop with your `widen`. And it costs nothing at
runtime: a running `Temperature` holds its `celsius` and nothing else.

## A fact about several fields

A constructor's statement may read any of its fields, and a field of a type that has slots is read
through its own slots. So a type can sum up its parts in one fact:

```eliot
data Pipes {risk: Frost}(inside: Temperature, outside: Temperature) {join(frost(inside), frost(outside))}

def startPump(p: Pipes) where isAboveFreezing(risk(p)) uses Console: Unit = printLine("pump on")
```

`startPump(Pipes(Temperature(18), Temperature(3)))` compiles. With a `Temperature(0)` on either
side, it does not. The statement calls the `join` of your own instance, which is an ordinary
function.

This is how a fact deep inside a structure reaches a precondition: each type states, in its own slot,
what the types around it need to know. A `where` reads the slot of the value it is given, never the
fields inside it, so a type flattens what matters about its fields into its slot.

## Types with several constructors

Each constructor states the slot from its own fields:

```eliot
data Heater {heat: Frost} = Boiler(flow: Temperature) {frost(flow)} | Off {MaybeFreezing}
```

A constructor without fields states a constant. Every constructor of a type with slots must state
them:

```text
error: The constructor 'Off' does not state the slots of its type 'Heater'.
```

There is no default, because there is no meta nobody accounted for.

## The rules

- **A slot is the type's own.** It sits beside what the compiler already follows. A `match` on a
  `Temperature` still hands its arm the `celsius` it was built with, with that value's range.
- **A statement lists every slot**, in the order they are declared, separated by commas, the way a
  type with two slots, like `List`, states both.
- **The statement is trusted.** The compiler runs `frostOf`; it does not check that `frostOf` is
  right. If it said `AboveFreezing` of `-3`, the pump would start. As with a
  [refined result]({{ '/docs/refining/' | relative_url }}), keep the statement small and obvious.
- **A slot may not be named like a field of its type**, since a `where` would read one under the
  name the code reads the other by. And slot names share one scope per file: two types in one file
  need two slot names, which is why `Pipes` has a `risk` and not a second `frost`.
- **A slot holds a domain of a fixed type.** `data Box[A] {full: Frost}(…)` is fine. A slot holding
  "whatever is known about an `A`", the way a list's `item` does, is not possible on a `data` type
  yet.
- **A type that contains itself cannot have slots yet**, for example a tree whose nodes hold trees.

> **One import clash to know about.** `eliot.compiler.Meta` and `eliot.collection.List` both
> declare a `joined`, so a file that imports both cannot use either `joined` by its bare name. In a
> file that implements `Meta`, name the list module's functions with their module instead, such as
> `eliot.collection.List::append(…)`.
{: .note}

## Refining a slot

A constructor states what it can see: the fields it is built from. A function that checks a value
knows more, and can say so with a brace after its result type, exactly as
[refining an `Int`]({{ '/docs/refining/' | relative_url }}) does:

```eliot
def checked(t: Temperature) uses Abort: Temperature {AboveFreezing} = if(t.celsius > 0) t
```

A `Temperature` built from a number read at runtime might be freezing, as far as the compiler can
tell. One that went through `checked` is known to be `AboveFreezing`, so this compiles:

```eliot
def main uses Console: Unit = {
   val read = parseInt(readLine orElse "") else 0
   startPump(checked(Temperature(read)) else Temperature(5))
}
```

The brace lists the type's slots, in order, and nothing else. Everything else the compiler knows
about the value is still what it followed: a `match` on the result still hands its arm the
`celsius` with the range it was built with. And as with every result brace, the compiler trusts it.

Next: [Under the hood]({{ '/docs/meta-domains/' | relative_url }}), where all of these pieces come
from.
