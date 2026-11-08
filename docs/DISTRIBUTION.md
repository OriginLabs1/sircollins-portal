# DISTRIBUTION — Android, without Google Play

The web portal at `https://sircollins.coreconcept1.net` is the product. The Android app is the
same portal **compiled into the APK**: `npm run build` writes `dist/`, Gradle copies it into
`assets/`, and a WebView serves it from the private origin
`https://appassets.androidplatform.net`. Nothing is fetched over the network.

That choice is deliberate:

- The app works on first launch, in airplane mode, and with no browser installed. The live
  origin is not a runtime dependency.
- Every feature is native to the APK: entries, acknowledgment import (`#ack=…`), the Giving QR,
  clipboard, sharing and image saving all run locally.
- No Google Play account, policy surface, or 30% cut. Distribution is direct.
- The app holds **no `INTERNET` permission**; external links (Telegram, GitHub, mail, social)
  are handed to the system browser or the matching app. The permission list is the guarantee.

The cost of bundling is that content changes require a new release. That is accepted: releases
are automatic and Obtainium surfaces them.

## Artifacts

| Artifact | Purpose |
| --- | --- |
| `sir-collins-portal.apk` | Sideload / Obtainium / Uptodown install |
| `sir-collins-portal.aab` | Optional, for any future store that accepts bundles |

Package id: `net.coreconcept1.sircollins` · min SDK 26 (Android 8.0) · target SDK 36.

## Where it ships

### 1. GitHub Releases (source of truth)

Every `v*` tag builds and publishes a signed APK through
[`.github/workflows/android.yml`](../.github/workflows/android.yml). The workflow runs
`npm ci && npm run build` first, then Gradle packages `dist/` into the APK.

```sh
git tag v0.0.4
git push origin v0.0.4
```

Latest release:
`https://github.com/OriginLabs1/sircollins-portal/releases/latest`

`v0.0.2` (the old TWA shell) and `v0.0.3` (the first bundled build) are published there.
`v0.0.4` adds the five-screen mobile app shell and the refreshed palette; it keeps the same
package id and signing key, so it installs straight over earlier releases without uninstalling.

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

The footer's **APK Format** action and the home “Open a channel” card point at the GitHub
`releases/latest/download/sir-collins-portal.apk` asset, which always resolves to the newest
signed APK.

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

## Deep links and Asset Links

The app claims `https://sircollins.coreconcept1.net` so that a carrier link
(`https://sircollins.coreconcept1.net/#ack=…`) or a link to an entry opens the
**bundled** copy instead of a web page. Android verifies that claim through Digital Asset
Links:

- `public/.well-known/assetlinks.json` — served at
  `https://sircollins.coreconcept1.net/.well-known/assetlinks.json`
- `android/app/src/main/AndroidManifest.xml` — the `autoVerify` intent filter for the host

Both must name the same package and the same SHA-256 fingerprint. **If the signing key changes,
update both files and rebuild.** A mismatch only disables link verification: the app still
opens normally, but taps on portal links may go to the browser first.

Verify after deploying:

```sh
curl -s https://sircollins.coreconcept1.net/.well-known/assetlinks.json | jq .
```

Google's own check, which is what Android consults:

```sh
curl -s "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://sircollins.coreconcept1.net&relation=delegate_permission/common.handle_all_urls"
```

A non-empty `statements` array naming the package and fingerprint means Android will hand the
portal's URLs to the app.

## Versioning

`versionCode` must increase on every release; `versionName` mirrors the web version in
`package.json`.

| Where | Field |
| --- | --- |
| `android/app/build.gradle.kts` | `versionCode`, `versionName` |
| `package.json` | `version` |
| `public/sw.js` | `CACHE_VERSION` (bump when the web shell changes) |

Because the portal is bundled, a content or feature change needs a **new APK release** to reach
installed users. The service worker only governs the website in a browser; the app does not use
it.

## Building locally

The build needs Node 22+, JDK 17+ and the Android SDK (`platforms;android-36`,
`build-tools;36.0.0`).

```sh
npm ci
npm run build                  # writes dist/
cd android
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew assembleRelease      # copies dist/ into assets/, then packages the APK
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
