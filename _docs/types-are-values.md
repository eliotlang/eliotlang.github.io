---
title: Types are values
nav_title: Types are values
order: 12
part: Generics & types
stub: true
summary: Type has type Type, defs can compute and return types, and you can match on a type's structure.
---

In Eliot a type is an ordinary value of type `Type`, and `Type` itself has type `Type`. This single
idea replaces a whole category of special-purpose language machinery.
{: .docs-lead}

> **This chapter is still being written.** Here's what it will cover, and where to look in the
> meantime.
{: .note}

## What this chapter will cover

- `Type : Type` — what it means for types to be first-class values, and why it's sound here.
- A `def` that **computes and returns a type**, then is used *as* a type:
  `def stringBox: Type = Box[String]` and then `def x: stringBox = …`.
- **Values as type arguments** — `Person["John"]`, `hello[1]` — and type expressions that compute
  (`Box[I.inc]`).
- **Matching on a type's structure** with `match` and `[…]` patterns:
  `case Person[name] -> name`.
- How this underpins generics, `where` preconditions, and the whole approach of putting proofs in the
  compiler.

## In the meantime

- Examples: [`FunctionAsType.els`]({{ site.github_repo }}/blob/main/examples/src/FunctionAsType.els),
  [`TypeValues.els`]({{ site.github_repo }}/blob/main/examples/src/TypeValues.els),
  [`TypeLevelMatch.els`]({{ site.github_repo }}/blob/main/examples/src/TypeLevelMatch.els),
  [`GenericTypes.els`]({{ site.github_repo }}/blob/main/examples/src/GenericTypes.els).
