---
title: "Under the hood: where meta-information comes from"
nav_title: Under the hood
order: 19
part: Meta-information
summary: How a type declares its meta-information, how the Meta ability joins and widens it, how platform primitives state what they do to it, and what adding a new kind would take.
---

The chapters so far used two kinds of meta-information: an `Int`'s range and a `String`'s size.
Neither is built into the compiler. Both are declared in the standard library, with mechanisms any
kind of meta-information shares. This chapter shows those mechanisms. You need them to read the
standard library's sources, and to add a new kind to a library or platform.
{: .docs-lead}

## A type declares its slots

```eliot
type Int {range: Interval[BigInteger]}
```

There are two halves to this declaration:

- **`type Int`, with no body**, is an abstract type: it says that integers exist, not how they are
  stored. Each platform answers that in its own [layer]({{ '/docs/layers/' | relative_url }}).
- **`{range: Interval[BigInteger]}`** declares the type's **meta slots**, each a name and a type.
  From it, the compiler generates the *meta structure* of an `Int`, as if you had written
  `data Int$Meta(range: Interval[BigInteger])`. That declares the accessor `range`, which you have
  used in `where` clauses. The `$` in its name keeps it out of your namespace, so you only meet it in
  error messages.

A type that declares no slots has nothing tracked about it, and its meta is `Unit`. That is still a
meta: *"nothing to know"* is something the compiler knows. So every value of every type has one.

## Combining metas: the `Meta` ability

The compiler needs two operations on a meta, and it gets them from an ordinary
[ability]({{ '/docs/abilities/' | relative_url }}) in `eliot.compiler.Meta`:

```eliot
ability Meta[D] {
   def join(a: D, b: D): D
   def widen(previous: D, next: D): D
}
```

**`join`** answers *"what covers both?"*. It is used wherever a value may come from more than one
branch: a `match`, a `fold`. For an interval, it is the narrowest interval containing both. That is
how `dutyOf` in the chapter on [following a value]({{ '/docs/following-values/' | relative_url }})
came out as `20..400`.

**`widen`** answers the same question, but must stop changing when it is repeated. It is used where
code may run any number of times, like a fold's function. The compiler follows the fold one
iteration at a time, and widens what it knew after each. For an interval, `widen` opens every end
that moved: a counter that was `0..0` and then `0..1` becomes *at least `0`*. An end can open only
once, so the compiler gets there in a couple of steps instead of a million. That is why a counting
fold came out as *at least `0`, no upper limit* earlier.

The instance for intervals is itself ordinary Eliot, in the standard library:

```eliot
implement[T ~ Compare[T]] Meta[Interval[T]] {
   def join(a: Interval[T], b: Interval[T]): Interval[T] =
      Interval(minBound(start(a), start(b)), maxBound(end(a), end(b)))
   def widen(previous: Interval[T], next: Interval[T]): Interval[T] =
      Interval(lowered(start(previous), start(next)), raised(end(previous), end(next)))
}
```

A meta structure like `Int$Meta` gets its `Meta` instance generated, slot by slot, from the
instances of its slots' types. Any type with a `Meta` instance can be a slot's type. Here is a
sketch of one that is not an interval, a value's sign:

```eliot
import eliot.compiler.Meta

data Sign = Negative | Zero | Positive | AnySign    // AnySign: the sign is not known

// …plus an `implement Eq[Sign]`, for the `==` below

implement Meta[Sign] {
   def join(a: Sign, b: Sign): Sign = if(a == b) a else AnySign
   def widen(previous: Sign, next: Sign): Sign = join(previous, next)
}
```

Two equal signs stay, and two different ones become `AnySign`. A `Sign` can change at most twice,
so here widening can simply be joining.

## Stated or derived

Every value's meta has exactly one source:

- **A value with an Eliot body derives its meta from that body.** This is the shadow run from the
  [first chapter]({{ '/docs/meta-information/' | relative_url }}): the compiler runs the body over
  the metas of its arguments.
- **A value without one states it.** These are the platform's *primitives*, implemented in the
  backend itself (bytecode, on the JVM), where the compiler cannot look. A primitive states its meta
  with a brace on its result, a **transfer**: how the result's meta follows from the arguments'.

Transfers are where every meta in your program ultimately comes from. These are the real
declarations from the standard library:

```eliot
def integerLiteral[V: BigInteger]: Int {closed(V, V)}

implement Numeric[Int] {
   def add(a: Int, b: Int): Int {range(a) + range(b)}
   def subtract(a: Int, b: Int): Int {range(a) - range(b)}
   def multiply(a: Int, b: Int): Int {range(a) * range(b)}
}

implement Combine[String] {
   def combine(a: String, b: String): String {size(a) + size(b)}
   def empty: String = ""
}

def length(s: String): Int {size(s)}
```

Every integer literal `7` in your program is a call to `integerLiteral[7]`, which is why a literal's
range is `7..7`. `+` is `add`, whose result's range is the sum of its operands' ranges. `length` turns
a string's size into an integer's range. These few lines are all of the arithmetic you saw in the
earlier chapters.

Because Eliot code [cannot recurse]({{ '/docs/totality/' | relative_url }}), deriving a meta from a
body always ends at primitives, and every primitive states. So every value has a meta, and the
compiler always finishes working them out.

## The rules for stating

A brace on a primitive's result is trusted: nothing checks it. It is an axiom the rest of the
program is checked against. So it follows strict rules.

- **Only a primitive states.** A value with a body derives, and a brace on its result is the error
  you met in [Preconditions]({{ '/docs/preconditions/' | relative_url }}#where-a-brace-may-go).
- **Every primitive states.** A primitive that returns a type with meta-information, and states
  nothing, does not compile. There is no meta nobody accounted for.
- **A statement must be true on every target and every input.** When the honest bound cannot be
  written, a primitive states a wider one, never a tighter guess. `parseInt` states a range open at
  both ends, because a string of digits can spell any number. `show` of an `Int` states *at least
  one character*: the true upper limit needs a logarithm no primitive offers. A wide statement only
  makes a demand fail. A wrong tight one would let a wrong program compile.
- **A statement lives in the layer that owns the fact.** `length`'s `{size(s)}` is true everywhere,
  so it is in the platform-independent base library. That a console line on the JVM is at most
  2,147,483,647 characters is a fact about the JVM, so it is stated in the JVM's layer.

## Adding a new kind of meta-information

Adding a kind of meta-information takes three things:

1. **A slot on a type**, declared where the type is declared: `type String {size: Interval[BigInteger]}`.
2. **A `Meta` instance** for the slot's type, unless it already has one, as `Interval` does.
3. **A statement on every primitive** that returns the type.

Nothing else. Derivation, `where`, parameter and field braces and the errors work for any kind of
meta-information. That is how `String`'s size was added beside `Int`'s range:
one slot, and a statement on each string primitive.

It is also why an ordinary program cannot add one. Step 3 needs primitives, and only a platform
declares primitives: your own code always has a body, so it always derives. That restriction is
what makes the system trustworthy. The only metas nobody checks are the platform's statements, and
there are few of them, each next to the primitive it describes.

> **One more rule for multi-slot types:** a brace states every slot of a type, or none. A second slot
> on `String` would mean every string primitive states both its size and the new slot.
{: .note}

## The whole part in five lines

- Every value has meta-information: what the compiler knows about it beyond its type.
- A value with a body derives it, and a primitive states it.
- A demand, a brace or a `where`, is checked at every call reached from `main`.
- A refined `data` field is proven at construction and known at every read.
- What the compiler cannot prove never passes.

Next: [Effects in direct style]({{ '/docs/effects/' | relative_url }}), the other half of what a
signature can say.
