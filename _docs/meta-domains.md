---
title: "Under the hood: where meta-information comes from"
nav_title: Under the hood
order: 21
part: Meta-information
summary: How a type declares its meta-information, how the Meta ability joins and widens it, the three places a meta comes from, how a platform states what its primitives do, and what adding a new kind takes.
---

The chapters so far used an `Int`'s range, a `String`'s length, a `List`'s size and items, and one
kind of your own. None of them is built into the compiler. All are declared in ordinary Eliot, with
mechanisms every kind of meta-information shares. This chapter shows those mechanisms. You need them
to read the standard library's sources, and to design a domain of your own well.
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

A `data` type declares slots the same way, `data Temperature {frost: Frost}(celsius: Int) {…}`, with
one addition: since a `data` type has constructors, each states its slots
([Meta-information of your own]({{ '/docs/custom-metas/' | relative_url }})).

A slot's accessor lives in a namespace of its own, separate from functions. That is why `String` can
have a `length` slot beside its `length` function: in a `where` or a brace, `length(s)` is the slot,
and in ordinary code it is the function. The two always agree, because the function's own
statement says so (below). Slot names are still one scope per file, so two domains whose slots share
a name cannot both be read by that bare name in one file.

A type that declares no slots has nothing tracked about it, and its meta is `Unit`. That is still a
meta: *"nothing to know"* is something the compiler knows. So every value of every type has one.

### What a `data` value carries without a slot

A `data` type with no slots is still followed. Its meta holds, out of sight, which constructors can
have built the value and what is known about each of their fields. That is how
`orZero(Some(200))` in [Following a value]({{ '/docs/following-values/' | relative_url }}) comes out
as `200..200`: the arm is handed the field's range, and the `None` arm is not joined in, since no
`None` can reach it. This part has no name you can write. A `where` cannot read it, which is what
declared slots are for.

### A slot about another type

A list's items can be of any type, so its `item` slot says "whatever is known about an `A`":

```eliot
type List[A] {size: Interval[BigInteger], item: Reach[MetaOf[A]]}
```

`MetaOf[A]` is the meta type of `A`: `Int$Meta` in a `List[Int]`, `String$Meta` in a `List[String]`.
`Reach` wraps it because a list may have no item at all: then `item` is `Unreached`, and `forAll`
holds of it. `MetaOf` may only appear in a slot, and today only in a `type`'s slots.

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
branch: a `match`, an `if … else`, a `fold` over a `Bool`. For an interval, it is the narrowest
interval containing both. That is how `dutyOf` in the chapter on
[following a value]({{ '/docs/following-values/' | relative_url }}) came out as `20..400`.

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
instances of its slots' types. Any type with a `Meta` instance can be a slot's type, which is all the
`Frost` of [Meta-information of your own]({{ '/docs/custom-metas/' | relative_url }}) needed.

When you design a domain, two properties keep it honest:

- **`join` must cover both sides.** Whatever is true of the join must be true of `a` and of `b`, or
  a branch can produce a value the meta does not describe.
- **`widen` must settle.** Asked over and over with growing inputs, it must stop changing after a few
  steps. A domain with a handful of values, like `Frost`, settles by joining. An interval needs real
  widening, because it can grow a million times by one.

The compiler cannot check either property. A `Meta` instance is trusted, like a statement.

## Where a meta comes from

Every value's meta has one of three sources:

- **Derived from a body.** A value with an Eliot body has its meta computed from that body. This is
  the shadow run from the [first chapter]({{ '/docs/meta-information/' | relative_url }}): the
  compiler runs the body over the metas of its arguments.
- **Stated by a primitive.** The platform's *primitives* are implemented in the backend itself
  (bytecode, on the JVM), where the compiler cannot look. A primitive states its result's meta with a
  brace on its result, a **transfer**: how the result's meta follows from the arguments'. It has to:
  there is nothing to derive from.
- **Stated by you.** A function with a body *may* also carry a brace on its result. It
  [refines the result]({{ '/docs/refining/' | relative_url }}): the stated meta replaces the derived
  one, while the body is still followed for everything else it does. A constructor's statement of its
  type's slots is the same kind of statement.

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
   def combine(a: String, b: String): String {length(a) + length(b)}
   def empty: String = ""
}

def length(s: String): Int {length(s)}

def empty[A]: List[A] {closed(0, 0), Unreached}
```

Every integer literal `7` in your program is a call to `integerLiteral[7]`, which is why a literal's
range is `7..7`. `+` is `add`, whose result's range is the sum of its operands' ranges. `length`
turns a string's length slot into an integer's range. An empty list states both of its slots: no
items, and so nothing known about them. These few lines are all of the arithmetic you saw in the
earlier chapters.

Because Eliot code [cannot recurse]({{ '/docs/totality/' | relative_url }}), deriving a meta from a
body always ends at primitives, and every primitive states. So every value has a meta, and the
compiler always finishes working them out.

## The rules for stating

A statement is trusted: nothing checks it. It is an axiom the rest of the program is checked
against. The platform's statements follow strict rules, and so should yours.

- **Every primitive states.** A primitive that returns a type with meta-information, and states
  nothing, does not compile. There is no meta nobody accounted for. For the same reason, every
  constructor of a type with slots states them.
- **A statement must be true on every target and every input.** When the honest bound cannot be
  written, a primitive states a wider one, never a tighter guess. `parseInt` states a range open at
  both ends, because a string of digits can spell any number. `show` of an `Int` states *at least
  one character*: the true upper limit needs a logarithm no primitive offers. A wide statement only
  makes a demand fail. A wrong tight one lets a wrong program compile.
- **A statement lives in the layer that owns the fact.** `length`'s `{length(s)}` is true everywhere,
  so it is in the platform-independent base library. That a console line on the JVM is at most
  2,147,483,647 characters is a fact about the JVM, so it is stated in the JVM's layer.

A refined result in your own code is held to the second rule by nobody but you. The compiler cannot
tell a careful statement from a wrong one, and it compiles both.

## Adding a new kind of meta-information

There are two ways, depending on whose type it is.

**On your own `data` type**, in any program or library: a domain with a `Meta` instance, a slot on
the type, and a statement on every constructor. That is the whole of
[Meta-information of your own]({{ '/docs/custom-metas/' | relative_url }}).

**On an abstract type that platforms implement**, like `String`: a slot on the `type`, a `Meta`
instance for the slot's type unless it has one, as `Interval` does, and a statement on every
primitive that returns the type. That is how `String`'s length was added beside `Int`'s range: one
slot, and a statement on each string primitive. Since primitives belong to platforms, this kind is
added in a [layer]({{ '/docs/layers/' | relative_url }}), together with the platforms that
implement it.

Either way, nothing else is needed. Derivation, `where`, braces on parameters, fields and results,
and the errors all work for any kind of meta-information.

> **One more rule for multi-slot types:** a brace states every slot of a type, or none. A second slot
> on `String` would mean every string primitive states both its length and the new slot.
{: .note}

## The whole part in six lines

- Every value has meta-information: what the compiler knows about it beyond its type.
- A value with a body derives it, and a primitive states it.
- A function may state its result's meta instead, and the compiler trusts it.
- A demand, a brace or a `where`, is checked at every call reached from `main`.
- A refined `data` field is proven at construction, and a slot of your own is stated there.
- What the compiler cannot prove never passes.

Next: [Effects in direct style]({{ '/docs/effects/' | relative_url }}), the other half of what a
signature can say.
