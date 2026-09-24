# SmartCapture PRO - Project Guidelines & Rules

## 📌 Semantic Versioning (SemVer 2.0.0) Rule

All releases, tags, and version updates across this repository MUST strictly follow [Semantic Versioning 2.0.0](https://semver.org/):

Format: `MAJOR.MINOR.PATCH` (e.g., `1.0.0`)

### 1. Version Increment Criteria

- **MAJOR (X.0.0)**:
  - Incompatible API or architectural breaking changes.
  - Breaking changes in Chrome extension manifest permissions, storage schema, or messaging contracts that break backwards compatibility.
  - Conventional Commit: `feat!:`, `fix!:`, or footer `BREAKING CHANGE:`.
  - Resets MINOR and PATCH to 0.

- **MINOR (x.Y.0)**:
  - Backwards-compatible new features, new capture modes, new editor studio tools, or enhanced export options.
  - Conventional Commit: `feat:`.
  - Resets PATCH to 0.

- **PATCH (x.y.Z)**:
  - Backwards-compatible bug fixes, UI/CSS alignment fixes, performance enhancements, and maintenance refactors.
  - Conventional Commit: `fix:`, `perf:`, `refactor:`.

### 2. Single Source of Truth

- The primary version number is tracked in [`manifest.json`](manifest.json) under `"version"`.
- When bumping version, always update `manifest.json` and ensure commit messages reflect the appropriate SemVer bump level.
