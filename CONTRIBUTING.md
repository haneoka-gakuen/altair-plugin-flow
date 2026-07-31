# Contributing

Use Node.js 20 or newer and pnpm 11. Run `pnpm check` before opening a change.
Keep the provider framework-neutral, deterministic, non-mutating, and
cancellation-safe. Add tests for contribution selection, graph semantics, and
plugin lifecycle changes.

Do not copy Altair's graph implementation into this wrapper. Do not commit
game assets, extracted game content, or credentials.

Maintainers publish from GitHub releases through npm trusted publishing. The
npm package must authorize this repository's `.github/workflows/publish.yml`
workflow before the first release.
