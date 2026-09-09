package at.lernapp;

import android.net.Uri;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import java.io.ByteArrayInputStream;
import java.util.Collections;
import java.util.Map;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

/** Framework-level regressions on Android 8 and 15; no remote requests. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = {26, 35})
public class StartupTest {
    @Test public void originalNonAsciiReasonPhraseThrows() {
        assertThrows(IllegalArgumentException.class, () -> new WebResourceResponse(
                "text/plain", "UTF-8", 404, "Nicht verfügbar", Collections.emptyMap(),
                new ByteArrayInputStream(new byte[0])));
    }

    @Test public void missingResourceResponseIsValid() throws Exception {
        WebResourceResponse response = MainActivity.notFoundResponse();
        assertEquals(404, response.getStatusCode());
        assertEquals("Not Found", response.getReasonPhrase());
        assertEquals(-1, response.getData().read());
    }

    @Test public void activityStartsAndHandlesMissingFaviconWithoutThrowing() throws Exception {
        try (ActivityController<MainActivity> controller = Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity = controller.get();
            WebView web = (WebView) ((ViewGroup) activity.findViewById(android.R.id.content)).getChildAt(0);
            for (String path : new String[]{"/index.html", "/app.js", "/core.js", "/icons.js", "/style.css", "/catalog.json"}) {
                WebResourceResponse response = web.getWebViewClient().shouldInterceptRequest(web,
                        new Request("https://appassets.androidplatform.net" + path));
                assertNotNull(path, response);
                assertEquals(path, 200, response.getStatusCode());
                assertTrue(path, response.getData().read() >= 0);
                response.getData().close();
            }
            for (String url : new String[]{"https://appassets.androidplatform.net/favicon.ico",
                    "https://appassets.androidplatform.net/missing.css", "https://example.invalid/blocked"}) {
                WebResourceResponse response = web.getWebViewClient().shouldInterceptRequest(web, new Request(url));
                assertEquals(404, response.getStatusCode());
                assertFalse(activity.isFinishing());
            }
        }
    }

    private static final class Request implements WebResourceRequest {
        private final Uri uri;
        Request(String url) { uri = Uri.parse(url); }
        public Uri getUrl() { return uri; }
        public boolean isForMainFrame() { return false; }
        public boolean isRedirect() { return false; }
        public boolean hasGesture() { return false; }
        public String getMethod() { return "GET"; }
        public Map<String, String> getRequestHeaders() { return Collections.emptyMap(); }
    }
}
