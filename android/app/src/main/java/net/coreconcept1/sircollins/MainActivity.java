package net.coreconcept1.sircollins;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;

/**
 * The app is self-contained: the portal is compiled into `assets/` (Gradle
 * copies `dist/` there) and served to a WebView from a private https origin.
 * Nothing is fetched from the network, so every screen, the QR generator, the
 * forms, and stored acknowledgments work in airplane mode and on the first
 * launch, with or without any browser installed.
 *
 * External destinations (Telegram, GitHub, mail, social profiles) are handed to
 * the system browser or the matching app. The app itself holds no INTERNET
 * permission, which is what guarantees the offline promise.
 *
 * The app also claims links to the public origin. A carrier link
 * (`https://sircollins.coreconcept1.net/#ack=...`) opens the installed app and
 * is applied to the local copy, so importing an acknowledgment needs no
 * network either.
 */
public class MainActivity extends Activity {

    private static final String NIGHT = "#05060F";
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String SITE_HOST = "sircollins.coreconcept1.net";
    private static final String START_URL = "https://appassets.androidplatform.net/index.html";

    private FrameLayout root;
    private WebView webView;
    private WebViewAssetLoader assetLoader;

    private String lastUrl = START_URL;
    private int rendererRestarts;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor(NIGHT));
        setContentView(root);

        configureSystemBars();

        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new PortalPathHandler(this))
                .build();

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    () -> {
                        if (webView != null && webView.canGoBack()) {
                            webView.goBack();
                        } else {
                            finish();
                        }
                    });
        }

        open(startUrlFrom(getIntent()));
    }

    @SuppressWarnings("deprecation")
    private void configureSystemBars() {
        getWindow().setStatusBarColor(Color.parseColor(NIGHT));
        getWindow().setNavigationBarColor(Color.parseColor(NIGHT));

        if (Build.VERSION.SDK_INT >= 35) {
            // Android 15 draws every app edge to edge and ignores decor fitting.
            // Pad the WebView so no copy hides under a system bar or the keyboard.
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets bars = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets ime = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
                return insets;
            });
        }
    }

    private void open(String url) {
        lastUrl = url;
        if (webView == null) {
            createWebView();
        }
        if (webView != null) {
            webView.loadUrl(url);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        final WebView view;
        try {
            view = new WebView(this);
        } catch (Throwable error) {
            showTextFallback();
            return;
        }

        view.setBackgroundColor(Color.parseColor(NIGHT));
        view.setOverScrollMode(View.OVER_SCROLL_NEVER);
        view.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setSupportMultipleWindows(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setGeolocationEnabled(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        float fontScale = getResources().getConfiguration().fontScale;
        settings.setTextZoom(Math.round(100 * fontScale));

        view.addJavascriptInterface(new Bridge(), "SirCollinsApp");

        view.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(
                    WebView webview,
                    WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView webview,
                    WebResourceRequest request) {
                return handleUrl(request.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView webview, String url) {
                return handleUrl(Uri.parse(url));
            }

            @Override
            public void onReceivedError(
                    WebView webview,
                    WebResourceRequest request,
                    android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) showHtmlFallback(webview);
            }

            @Override
            public boolean onRenderProcessGone(
                    WebView webview,
                    RenderProcessGoneDetail detail) {
                // A crashed renderer must never take the app with it.
                destroyWebView(webview);
                if (rendererRestarts < 1) {
                    rendererRestarts += 1;
                    root.post(() -> open(lastUrl));
                } else {
                    showTextFallback();
                }
                return true;
            }
        });

        view.setWebChromeClient(new WebChromeClient());
        webView = view;
        root.addView(view);
    }

    private void destroyWebView(WebView view) {
        if (view.getParent() instanceof ViewGroup) {
            ((ViewGroup) view.getParent()).removeView(view);
        }
        view.removeJavascriptInterface("SirCollinsApp");
        view.destroy();
        if (webView == view) webView = null;
    }

    private boolean handleUrl(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);

        if ("https".equals(scheme) && APP_HOST.equals(host)) return false;
        if ("https".equals(scheme) && SITE_HOST.equals(host)) {
            // The public site is bundled. Keep the shareable fragment
            // (`#ack=…`, `#entry-…`) and never touch the network.
            String fragment = uri.getFragment();
            open(fragment == null || fragment.isEmpty()
                    ? START_URL
                    : START_URL + "#" + fragment);
            return true;
        }
        if ("about".equals(scheme) || "javascript".equals(scheme)) return false;

        openExternally(uri);
        return true;
    }

    private void openExternally(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException | SecurityException error) {
            // No browser or mail app installed: stay in the portal, never crash.
            Toast.makeText(this, "No app can open this link.", Toast.LENGTH_SHORT).show();
        }
    }

    private String startUrlFrom(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null) return START_URL;

        String scheme = data.getScheme() == null ? "" : data.getScheme().toLowerCase(Locale.ROOT);
        String host = data.getHost() == null ? "" : data.getHost().toLowerCase(Locale.ROOT);
        if (!"https".equals(scheme) || !SITE_HOST.equals(host)) return START_URL;

        String fragment = data.getFragment();
        return fragment == null || fragment.isEmpty() ? START_URL : START_URL + "#" + fragment;
    }

    private void showHtmlFallback(WebView view) {
        String html = "<!doctype html><html><head>"
                + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                + "<style>body{background:" + NIGHT + ";color:#eef1ff;font:16px system-ui;"
                + "display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;"
                + "padding:24px}p{max-width:34ch;line-height:1.6;color:#a7aecb}"
                + "a{color:#9ec1e6}</style></head><body><div>"
                + "<h1>Sir Collins Portal</h1>"
                + "<p>The bundled copy could not be read. Reinstall the app from "
                + "github.com/OriginLabs1/sircollins-portal/releases, then open it again.</p>"
                + "<p><a href=\"" + START_URL + "\">Try again</a></p>"
                + "</div></body></html>";
        view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    private void showTextFallback() {
        TextView message = new TextView(this);
        message.setText("Sir Collins Portal could not start. Reinstall it from "
                + "github.com/OriginLabs1/sircollins-portal/releases.");
        message.setTextColor(Color.parseColor("#EEF1FF"));
        message.setTextSize(16);
        message.setPadding(48, 96, 48, 48);
        message.setGravity(android.view.Gravity.CENTER);
        root.removeAllViews();
        root.addView(message, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        webView = null;
    }

    /**
     * Saves a canvas image (the Giving QR) without a network or a storage
     * permission: MediaStore on Android 10+, the app's own pictures directory
     * on older versions.
     */
    private class Bridge {
        @JavascriptInterface
        public boolean saveImage(String dataUrl, String fileName) {
            if (dataUrl == null) return false;
            int comma = dataUrl.indexOf(',');
            if (comma < 0) return false;

            final byte[] bytes;
            try {
                bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
            } catch (IllegalArgumentException error) {
                return false;
            }

            String safeName = fileName == null
                    ? "sir-collins.png"
                    : fileName.replaceAll("[^A-Za-z0-9._-]", "-");
            final String message;
            try {
                message = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? saveToDownloads(bytes, safeName)
                        : saveToAppPictures(bytes, safeName);
            } catch (Exception error) {
                return false;
            }

            runOnUiThread(() -> Toast.makeText(
                    MainActivity.this, message, Toast.LENGTH_LONG).show());
            return true;
        }

        @JavascriptInterface
        public boolean copyText(String value) {
            if (value == null) return false;
            runOnUiThread(() -> {
                ClipboardManager clipboard =
                        (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (clipboard != null) {
                    clipboard.setPrimaryClip(ClipData.newPlainText("Sir Collins", value));
                }
            });
            return true;
        }

        @JavascriptInterface
        public boolean shareText(String title, String text, String url) {
            try {
                String body = text == null ? "" : text;
                if (url != null && !url.isEmpty()) {
                    body = body.isEmpty() ? url : body + "\n" + url;
                }

                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_SUBJECT, title == null ? "Sir Collins" : title);
                send.putExtra(Intent.EXTRA_TEXT, body);

                runOnUiThread(() -> {
                    try {
                        startActivity(Intent.createChooser(
                                send,
                                title == null ? "Share" : title));
                    } catch (ActivityNotFoundException error) {
                        Toast.makeText(
                                MainActivity.this,
                                "No app can share this link.",
                                Toast.LENGTH_SHORT).show();
                    }
                });
                return true;
            } catch (Exception error) {
                return false;
            }
        }
    }

    private String saveToDownloads(byte[] bytes, String fileName) throws Exception {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
        values.put(MediaStore.Downloads.MIME_TYPE, "image/png");
        values.put(MediaStore.Downloads.RELATIVE_PATH,
                Environment.DIRECTORY_DOWNLOADS + "/Sir Collins");
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) return "Could not save the image.";

        try (OutputStream stream = getContentResolver().openOutputStream(uri)) {
            if (stream == null) return "Could not save the image.";
            stream.write(bytes);
        }

        values.clear();
        values.put(MediaStore.Downloads.IS_PENDING, 0);
        getContentResolver().update(uri, values, null, null);
        return "Saved to Downloads/Sir Collins/" + fileName;
    }

    private String saveToAppPictures(byte[] bytes, String fileName) throws Exception {
        File directory = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        if (directory == null) directory = getFilesDir();
        File file = new File(directory, fileName);
        try (FileOutputStream stream = new FileOutputStream(file)) {
            stream.write(bytes);
        }
        return "Saved to " + file.getAbsolutePath();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        open(startUrlFrom(intent));
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            destroyWebView(webView);
        }
        super.onDestroy();
    }

    /**
     * Serves `assets/` through WebViewAssetLoader. MIME types are set here
     * rather than guessed, because fonts and the web manifest are missing from
     * some devices' tables and a wrong type can make a font silently fail.
     */
    private static final class PortalPathHandler implements WebViewAssetLoader.PathHandler {
        private final Context context;

        PortalPathHandler(Context context) {
            this.context = context;
        }

        @Override
        public WebResourceResponse handle(String path) {
            String relative = path.startsWith("/") ? path.substring(1) : path;
            if (relative.isEmpty()) relative = "index.html";

            // Never allow the page to reach outside the bundled assets.
            if (relative.contains("..") || relative.contains("\\") || relative.startsWith("/")) {
                return null;
            }

            String lower = relative.toLowerCase(Locale.ROOT);
            String mime = mimeTypeFor(lower);
            String encoding = mime.startsWith("text/")
                    || mime.contains("json")
                    || mime.contains("javascript")
                    || mime.contains("xml")
                    ? "utf-8"
                    : null;

            try {
                InputStream stream = context.getAssets().open(relative);
                return new WebResourceResponse(mime, encoding, 200, "OK", null, stream);
            } catch (IOException error) {
                return null;
            }
        }

        private static String mimeTypeFor(String path) {
            if (path.endsWith(".html") || path.endsWith(".htm")) return "text/html";
            if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript";
            if (path.endsWith(".css")) return "text/css";
            if (path.endsWith(".webmanifest")) return "application/manifest+json";
            if (path.endsWith(".json")) return "application/json";
            if (path.endsWith(".svg")) return "image/svg+xml";
            if (path.endsWith(".png")) return "image/png";
            if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
            if (path.endsWith(".woff2")) return "font/woff2";
            if (path.endsWith(".woff")) return "font/woff";
            if (path.endsWith(".txt")) return "text/plain";
            return "application/octet-stream";
        }
    }
}
