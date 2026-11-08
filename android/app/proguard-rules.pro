# The activity is named from the manifest, and the JavaScript bridge is looked
# up by name from the page. Keep both, including annotated bridge methods.
-keep class net.coreconcept1.sircollins.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# androidx.webkit ships consumer rules; silence any optional references that R8
# cannot resolve in the release variant.
-dontwarn androidx.webkit.**
