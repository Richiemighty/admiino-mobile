# Dependency management standard

Add a dependency only when it solves a documented requirement that cannot be met cleanly with the current platform or repository tooling. Record its purpose in the PR, confirm ownership and maintenance activity, and avoid overlapping libraries.

## Compatibility and native impact

1. Read the installed Expo SDK, React Native, and React versions from `package.json`.
2. For Expo-managed or native modules, check the matching versioned Expo documentation and run `npx expo install <package>` so Expo selects a compatible version. Follow with `npx expo install --check` and `npx expo-doctor`.
3. For JavaScript-only and development dependencies, inspect supported Node/React/React Native peer ranges, release cadence, license, bundle/unpacked size, transitive dependency count, and whether an existing package already provides the capability.
4. Native modules change the binary and require a rebuilt Expo Development Client; they are not made available by updating JavaScript in Expo Go alone. Note build-profile/platform consequences in the PR.
5. Keep dependency versions and `package-lock.json` in sync. Use `npm ci` to verify reproducible installs.

## Security advisories

Run `npm audit` when adding/updating dependencies and review `npm audit --omit=dev` separately to distinguish app/runtime-tree findings from tooling. Document the advisory, affected dependency path, severity, exposure, and a compatible remediation. Prefer an Expo-SDK-compatible patch/minor update or a narrowly scoped, verified override. Do not use `npm audit fix --force`, downgrade the Expo SDK to satisfy an unrelated advisory, or hide findings with audit-level configuration. If no compatible fix exists, record an owner and review date, monitor upstream, and avoid introducing additional exposure.

## Existing audit findings at P04

The pre-P04 lockfile reported three moderate package findings (zero high/critical). They represent one transitive issue in the Expo fingerprint path, not three independent vulnerabilities:

| Reported package            | Classification                                                                       | Finding and response                                                                                                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `expo@58.0.26`              | Direct app dependency; its fingerprinting path is used by Expo project/build tooling | npm audit links this to `@expo/fingerprint` and `minimatch`. Keep the SDK on its approved major; update to an Expo SDK-compatible release when Expo supplies a compatible fix.                                                                                                                                                             |
| `@expo/fingerprint@0.21.10` | Transitive Expo tooling dependency                                                   | Depends on the affected `minimatch` range. Check future Expo patch releases and rerun Expo Doctor and the test suite.                                                                                                                                                                                                                      |
| `minimatch@10.2.6`          | Transitive dependency of fingerprint tooling                                         | GHSA-g3hv-75wg-m249 covers versions `>=7.0.0 <11.0.1` for a potential globparts-amplification denial of service. The registry's suggested Expo downgrade is to SDK 52 and is not acceptable. A cross-major override is not applied; only consider a compatible upstream fix or an override after Expo fingerprint/EAS compatibility tests. |

These are moderate-severity findings with no high or critical findings. `npm audit --omit=dev` returns the same three package findings because this Expo dependency path is retained from the direct `expo` package, although the vulnerable fingerprinting code is used for tooling rather than shipped application logic. No audit fix was applied in P04. The Jest 30 toolchain candidate was rejected because it added further moderate findings; the selected Jest 29 / SDK 58 test stack leaves the audit at the original three.

## P04 test-tooling additions

- `jest-expo@58.0.6`, `jest@29.7.0`, and `@testing-library/react-native@14.1.0` provide the requested SDK-matched component-test environment and support React 19 / React Native 0.88.
- `@types/jest`, Prettier, and `eslint-plugin-simple-import-sort` are development-only tools for test typing, consistent formatting, and import conventions.
- The Expo install helper timed out while querying its registry metadata. The test preset version and peer ranges were checked directly; `jest-expo@58.0.6` declares the SDK 58 React Native Jest preset peer range and resolves to `@react-native/jest-preset@0.88.1`.
- Expo Doctor's current bundled recommendation is newer (`jest-expo@~58.0.15`, Jest `~30.5.2`, and `@types/jest@30.0.0`). That Jest 30 set introduced 19 additional moderate audit findings in test tooling. P04 retains the compatible Jest 29 preset/toolchain to avoid those added findings. Only these three non-native test packages are listed in `expo.install.exclude`; all native/Expo-managed package checks remain active. Peer ranges were checked, and the complete test suite passes. Revisit the exclusion when Expo provides an SDK-compatible preset/Jest set without the added advisories.

Network tests replace `global.fetch` with a reset Jest mock. Use `mockFetchJson` and synthetic responses from approved endpoint contracts; do not make real requests. Add domain fixtures for authentication, permissions, workspaces, tasks, or notifications only when their response schemas are approved. Unconfigured requests should fail rather than fall through to the network.
