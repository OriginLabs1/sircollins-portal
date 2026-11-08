# The TWA launcher is referenced from the manifest; keep its entry points.
-keep class com.google.androidbrowserhelper.** { *; }
-dontwarn com.google.androidbrowserhelper.**

# AndroidX FileProvider is referenced from the manifest.
-keep class androidx.core.content.FileProvider { *; }
