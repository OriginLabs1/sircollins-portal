import java.util.Properties
import org.gradle.api.tasks.Sync

plugins {
    id("com.android.application")
}

/**
 * The portal is compiled into the APK: `dist/` is copied to `assets/` and
 * served to a WebView from a private https origin. The app is therefore fully
 * usable with no network and without any installed browser.
 *
 * Distribution is deliberately not Google Play: GitHub Releases is the source
 * of truth, and Obtainium / Uptodown read from it. See docs/DISTRIBUTION.md.
 */

val webDist = providers.gradleProperty("webDist")
    .map { file(it) }
    .orElse(layout.projectDirectory.dir("../../dist").asFile)

val syncWebAssets by tasks.registering(Sync::class) {
    description = "Copies the built web portal into the app's assets."
    from(webDist) {
        // Pages-only configuration is meaningless inside the APK, and the
        // service worker is redundant when every file already ships in it.
        exclude("_headers", ".well-known/**", "sw.js")
    }
    into(layout.buildDirectory.dir("generated/webAssets"))
    doFirst {
        val index = webDist.get().resolve("index.html")
        if (!index.exists()) {
            throw GradleException(
                "Web build missing at ${index.path}. Run `npm run build` first, " +
                    "or pass -PwebDist=/path/to/dist.",
            )
        }
    }
}

android {
    namespace = "net.coreconcept1.sircollins"
    compileSdk = 36

    defaultConfig {
        applicationId = "net.coreconcept1.sircollins"
        minSdk = 26
        targetSdk = 36
        versionCode = 4
        versionName = "0.0.4"
    }

    sourceSets.getByName("main").assets.srcDir(syncWebAssets)

    signingConfigs {
        create("release") {
            val propertiesFile = rootProject.file("keystore.properties")
            if (propertiesFile.exists()) {
                val properties = Properties()
                propertiesFile.inputStream().use { stream -> properties.load(stream) }
                storeFile = rootProject.file(properties.getProperty("storeFile"))
                storePassword = properties.getProperty("storePassword")
                keyAlias = properties.getProperty("keyAlias")
                keyPassword = properties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            signingConfig = signingConfigs.findByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources.excludes += setOf(
            "META-INF/AL2.0",
            "META-INF/LGPL2.1",
        )
    }
}

// Some AGP tasks scan the asset directory without inheriting the source-set
// dependency, so hook them explicitly. `srcDir(syncWebAssets)` covers the rest.
tasks.configureEach {
    val lintOrAssets = name.contains("lint", ignoreCase = true) || name.contains("Assets")
    if (name != "syncWebAssets" && lintOrAssets) {
        dependsOn(syncWebAssets)
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
