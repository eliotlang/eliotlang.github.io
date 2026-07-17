---
title: Abilities
nav_title: Abilities
order: 13
part: Generics & types
stub: true
summary: Eliot's type classes — declaring an ability, implementing it, constraining generics, and the minimal-algebra design rule.
---

An *ability* is Eliot's type class: a named set of operations a type can implement, dispatched
entirely at compile time with no runtime dictionaries.
{: .docs-lead}

> **This chapter is still being written.** Here's what it will cover, and where to look in the
> meantime.
{: .note}

## What this chapter will cover

- Declaring an `ability` and giving a type an `implement`:

  ```eliot
  ability Display[A] {
     def display(a: A): String
  }

  implement Display[Hello] {
     def display(a: Hello): String = "Hello World!"
  }
  ```

- **Constraining a generic** with `~`: `def displayAnything[A ~ Display](thing: A): String`.
- **Conditional instances**: `implement[A ~ Display] Display[Box[A]]` — a `Box[A]` is displayable when
  its contents are.
- **Coherence**: an instance must be unique per type combination and colocated with either the
  ability's module or the target type's module.
- The **minimal-algebra design rule** — put only the irreducible primitive operations *inside* an
  ability, and every derived convenience *outside* as a plain function — and why that matters for a
  language that must stay small.
- How abilities resolve at monomorphization (no runtime cost) and how they connect to the effect
  system, which is built on abilities.

## In the meantime

- Examples: [`Ability.els`]({{ site.github_repo }}/blob/main/examples/src/Ability.els),
  [`AbilityConstraint.els`]({{ site.github_repo }}/blob/main/examples/src/AbilityConstraint.els),
  [`AbilityDerive.els`]({{ site.github_repo }}/blob/main/examples/src/AbilityDerive.els),
  [`ArithmeticAbility.els`]({{ site.github_repo }}/blob/main/examples/src/ArithmeticAbility.els).
- The [API reference]({{ '/apidoc/' | relative_url }}) shows the shipped abilities (`Show`, `Eq`,
  `Compare`, `Numeric`, and the effect abilities).
