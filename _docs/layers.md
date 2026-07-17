---
title: Layers and platform independence
nav_title: Layers
order: 22
part: In the large
stub: true
summary: How an abstract, platform-neutral base is merged with concrete platform layers — the model that lets one program target the JVM and a microcontroller.
---

Layers are how Eliot stays platform-independent without giving up on small, concrete code generation.
An abstract base declares *what* exists; platform layers supply *how* it's represented and run. This
is an advanced topic — mostly relevant when porting Eliot to new hardware or reading the standard
library.
{: .docs-lead}

> **This chapter is still being written.** Here's what it will cover, and where to look in the
> meantime.
{: .note}

## What this chapter will cover

- The **abstract base** (`stdlib`): abstract `type`s, body-less `def` signatures, and `ability`
  declarations — everything platform-neutral, as you saw when we read `Option.els` and `Int.els`.
- **Platform layers** (like `jvm`): the concrete `data`, `def` bodies, native leaves, and `implement`s
  that give the base a representation on a specific target.
- **Merge, not inheritance**: the same module name across layers is *merged* — a layer may add a body
  but must keep the signature identical. The merge prefers the concrete definition.
- **Sanctioned duplication** and the abstract↔concrete signature-equality rules that keep it sound.
- Why "the compiler is itself a platform", and what that buys the whole design.

## In the meantime

- Read a base/platform pair side by side: `stdlib/eliot/eliot/lang/Option.els` (abstract) versus
  `jvm/eliot/eliot/lang/Option.els` (concrete) in the
  [compiler repository]({{ site.github_repo }}/tree/main).
- The compiler's own `eliot-layers` skill and the design notes under
  [`docs/`]({{ site.github_repo }}/tree/main/docs) go deep on the mechanics.
