# DISTRIBUTION — Android, without Google Play

The web portal at `https://sircollins.coreconcept1.net` is the product. The Android app is a
**Trusted Web Activity (TWA)**: a thin shell that opens the live origin in the user's own browser
engine after verifying the site through Digital Asset Links.

That choice is deliberate:

- One source of truth. A web deploy reaches every installed app immediately; no store review,
  no rebuild, no version skew.
- No Google Play account, policy surface, or 30% cut. Distribution is direct.
- The APK stays small (no bundled web assets) and the app inherits Chrome's rendering,
  password manager, and security updates.

## Artifacts

| Artifact | Purpose |
| --- | --- |
| `sir-collins-portal.apk` | Sideload / Obtainium / Uptodown install |
| `sir-collins-portal.aab` | Optional, for any future store that accepts bundles |

Package id: `net.coreconcept1.sircollins` · min SDK 26 (Android 8.0) · target SDK 36.

## Where it ships

### 1. GitHub Releases (source of truth)

Every `v*` tag builds and publishes a signed APK through
[`.github/workflows/android.yml`](../.github/workflows/android.yml).

```sh
git tag v0.0.2
git push origin v0.0.2
```

Latest release:
`https://github.com/OriginLabs1/sircollins-portal/releases/latest`

`v0.0.2` is published there: `sir-collins-portal.apk` (signed) and
`sir-collins-portal.aab`.

Users install by downloading the APK and allowing installs from the browser or file manager once.

### 2. Obtainium (automatic updates)

[Obtainium](https://github.com/ImranR98/Obtainium) watches GitHub Releases and prompts on each new
version — the closest thing to a store update without a store.

Add this URL in Obtainium:

```
https://github.com/OriginLabs1/sircollins-portal
```

Obtainium reads the release's APK asset. Keep the asset name stable
(`sir-collins-portal.apk`) so the pattern continues to match; the workflow does this.

### 3. Uptodown

Uptodown accepts direct developer uploads without Google Play.

1. Create the developer profile at `https://en.uptodown.com/developers`.
2. Upload `sir-collins-portal.apk` from the latest GitHub Release.
3. Reuse the release notes; link back to the portal for the canonical description.

Uptodown re-signs nothing — the APK must already be signed with the release key, which the
workflow guarantees. Because Uptodown hosts its own copy, publish there **after** the GitHub
Release exists so both carry the same build.

### 4. Direct link

The footer's **Get the app** action points at the GitHub `releases/latest` page, which always
resolves to the newest signed APK.

## Signing and custody

- Keystore: `android/keystore/release.jks`, alias `sircollins`, RSA 4096, 10 000 days.
- Credentials: `android/keystore.properties` (gitignored).
- SHA-256 fingerprint:
  `D9:34:89:15:59:C6:91:72:AB:5D:E5:42:F1:07:D4:AB:ED:BF:1A:10:08:49:8D:01:7C:57:D9:63:5D:57:7D:F2`

**This key is the app's identity.** Losing it means every future update is a different app and
users must uninstall to upgrade. Back up `release.jks` and its password offline, in two places,
before the first public release. Never commit either file.

For CI, store the same material as repository secrets:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 android/keystore/release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | store password |
| `ANDROID_KEY_ALIAS` | `sircollins` |

## Digital Asset Links

The TWA only drops the browser address bar when the origin vouches for the app:

- `public/.well-known/assetlinks.json` — served at
  `https://sircollins.coreconcept1.net/.well-known/assetlinks.json`
- `android/app/src/main/res/values/strings.xml` → `asset_statements` — the same statement,
  compiled into the APK

Both must name the same package and the same SHA-256 fingerprint. **If the signing key changes,
update both files and rebuild.** A mismatch leaves the app running with browser chrome visible.

Verify after deploying:

```sh
curl -s https://sircollins.coreconcept1.net/.well-known/assetlinks.json | jq .
```

Google's own check, which is what Android consults:

```sh
curl -s "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://sircollins.coreconcept1.net&relation=delegate_permission/common.handle_all_urls"
```

A non-empty `statements` array naming the package and fingerprint means the TWA
will open without browser chrome.

## Versioning

`versionCode` must increase on every release; `versionName` mirrors the web version in
`package.json`.

| Where | Field |
| --- | --- |
| `android/app/build.gradle.kts` | `versionCode`, `versionName` |
| `package.json` | `version` |
| `public/sw.js` | `CACHE_VERSION` (bump when the shell changes) |

A copy-only web change needs no APK release at all — installed apps pick it up on next open.

## Building locally

The build needs JDK 17+ and the Android SDK (`platforms;android-36`, `build-tools;36.0.0`).

```sh
cd android
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`.

On an ARM64 host the x86-64 AAPT2 binary cannot run natively. Point Gradle at a wrapper that
execs it through QEMU:

```sh
printf '#!/bin/sh\nexec qemu-x86_64 /path/to/extracted/aapt2 "$@"\n' > /tmp/aapt2
chmod +x /tmp/aapt2
./gradlew assembleRelease -Pandroid.aapt2FromMavenOverride=/tmp/aapt2
```

CI runs on x86-64 and needs no shim.
