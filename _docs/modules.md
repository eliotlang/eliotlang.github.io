---
title: Modules and imports
nav_title: Modules & imports
order: 21
part: In the large
stub: true
summary: One file is one module, how names resolve per file, the auto-imported prelude, and why effects always need an import.
---

Every `.els` file is a module, and its name comes from its path. Understanding how names resolve —
and what's ambient versus import-required — removes most "unknown name" surprises.
{: .docs-lead}

> **This chapter is still being written.** Here's what it will cover, and where to look in the
> meantime.
{: .note}

## What this chapter will cover

- **File = module**: `eliot/lang/String.els` is the module `eliot.lang.String`; declarations may appear
  in any order.
- **Imports**: `import eliot.collection.List` — dotted lowercase packages plus one Uppercase module
  name, bringing in every name that module declares.
- **The auto-imported prelude**: the *entire* `eliot.lang` package is ambient in every file — `Bool`,
  `Option`, `Pair`, `Either`, `Int`, `Interval`, `Numeric`, `Show`, `String`, and the rest — so you use
  `show`, `fold`, `+`, `Option`, and friends with no import. The bare name `Type` is ambient too.

  > Re-importing a prelude module (`import eliot.lang.Bool`) is an **error** — it double-imports and
  > shadows. Only import what isn't already ambient.
  {: .warn}

- **Effects are always import-required**: everything in `eliot.effect` (`Console`, `Log`, `Throw`,
  `Abort`, `State`, `Dep`, `Inf`, …) must be imported explicitly.
- **Per-file resolution**: a file sees its own declarations plus its imports — never names declared in
  a sibling file of the same module.

## In the meantime

- Every example in this guide shows the import discipline in practice — note how they import
  `eliot.effect.*` but never `eliot.lang.*`.
