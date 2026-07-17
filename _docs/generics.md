---
title: Generics and auto
nav_title: Generics & auto
order: 11
part: Generics & types
stub: true
summary: Type parameters, higher-kinded parameters, value parameters, and the auto keyword that omits what the compiler can recover.
---

Generics let a definition work over many types at once — and in Eliot, because types are values, a
generic parameter can even be a *number* or a *string*.
{: .docs-lead}

> **This chapter is still being written.** Here's what it will cover, and where to look in the
> meantime.
{: .note}

## What this chapter will cover

- **Type parameters** `[A]`, written in UPPERCASE, as on `data Maybe[A]` and
  `def describe[A](x: A): String`.
- **Higher-kinded parameters** `[F[_]]` — a parameter that is itself a type constructor, the shape
  behind the effect system's carriers.
- **Value parameters** `[I: BigInteger]`, `[NAME: String]` — since types are values, a generic can be
  a compile-time number or string (`hello[1]`, `Person["John"]`).
- **`auto`** — parameters you can omit at the use site because the compiler infers or calculates
  them; and how omitting a return range *calculates* the tightest bounds from the body.
- Passing **explicit type arguments** (`Box[String]`, `hello[1]`) and the empty-`[]` marker that
  forces a name into the type namespace.
- **Constraints** with `~` (`[A ~ Show]`), which lead into the next chapters.

## In the meantime

- Examples: [`GenericTypes.els`]({{ site.github_repo }}/blob/main/examples/src/GenericTypes.els),
  [`ImplicitIntParam.els`]({{ site.github_repo }}/blob/main/examples/src/ImplicitIntParam.els),
  [`ImplicitIntReturn.els`]({{ site.github_repo }}/blob/main/examples/src/ImplicitIntReturn.els),
  [`MonomorphCheck.els`]({{ site.github_repo }}/blob/main/examples/src/MonomorphCheck.els).
- The next chapter, [Types are values]({{ '/docs/types-are-values/' | relative_url }}), shows why
  value parameters work at all.
