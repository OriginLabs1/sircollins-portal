import java.util.Properties

plugins {
    id("com.android.application")
}

/**
 * The Android shell is a Trusted Web Activity: it owns no content and no
 * domain logic. It launches the canonical PWA in the user's browser engine and
 * verifies the origin through Digital Asset Links. A web deploy reaches the app
 * without an app-store release.
 *
 * Distribution is deliberately not Google Play: GitHub Releases is the source
 * of truth, and Obtainium / Uptodown read from it. See docs/DISTRIBUTION.md.
 */
android {
    namespace = "net.coreconcept1.sircollins"
    compileSdk = 36

    defaultConfig {
        applicationId = "net.coreconcept1.sircollins"
        minSdk = 26
        targetSdk = 36
        versionCode = 2
        versionName = "0.0.2"
    }

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

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.4")
    implementation("androidx.core:core:1.13.1")
}
