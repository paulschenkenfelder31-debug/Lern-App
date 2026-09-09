package at.lernapp;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.AtomicFile;
import android.webkit.*;
import android.view.View;
import org.json.*;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;

/** Native offline storage and network boundary. Only bundled UI gets the JS bridge. */
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String SOURCE = "https://www.f-online.app/page-data/at/fragenkatalog/alle-fragen/page-data.json";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private WebView web;
    private volatile boolean syncing;
    private String exportText;
    private static final int EXPORT = 10, IMPORT = 11;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(0xfff5f6fa);
        web.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        setContentView(web);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        CookieManager.getInstance().setAcceptCookie(false);
        web.addJavascriptInterface(new Bridge(), "Native");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                // All navigation is disallowed: source links use the system browser via a fixed allowlist.
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                Uri uri = req.getUrl();
                try {
                    if ("https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())) {
                        String path = uri.getPath();
                        if ("/catalog.json".equals(path)) return json(read("catalog.json", "{\"questions\":[],\"meta\":{}}"));
                        if (path != null && path.matches("/(index.html|app.js|core.js|style.css)")) {
                            String mime = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html";
                            return new WebResourceResponse(mime,"UTF-8",getAssets().open(path.substring(1)));
                        }
                    }
                    if ("https".equals(uri.getScheme()) && "img.f-online.at".equals(uri.getHost()) && uri.getPath().matches("/[0-9]+\\.jpg")) {
                        return new WebResourceResponse("image/jpeg", null, new ByteArrayInputStream(imageBytes(uri.toString())));
                    }
                } catch (Exception ignored) { }
                return notFoundResponse();
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.loadUrl(ORIGIN + "/index.html");
    }
    // Android rejects non-ASCII HTTP reason phrases. Keep localized text in the
    // UI/body, never in this protocol field (including missing favicon requests).
    static WebResourceResponse notFoundResponse() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
    private WebResourceResponse json(String s) { return new WebResourceResponse("application/json", "UTF-8", new ByteArrayInputStream(s.getBytes(StandardCharsets.UTF_8))); }
    private synchronized String read(String name, String fallback) {
        try (InputStream in = new AtomicFile(new File(getFilesDir(), name)).openRead()) { return new String(bounded(in, 30_000_000), StandardCharsets.UTF_8); }
        catch (Exception e) { return fallback; }
    }
    private synchronized void write(String name, String content) throws IOException {
        AtomicFile f = new AtomicFile(new File(getFilesDir(), name));
        FileOutputStream out = null;
        try { out = f.startWrite(); out.write(content.getBytes(StandardCharsets.UTF_8)); f.finishWrite(out); }
        catch (IOException e) { if (out != null) f.failWrite(out); throw e; }
    }
    private byte[] bounded(InputStream in, int max) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buffer = new byte[16384]; int n;
        while ((n = in.read(buffer)) != -1) { if (out.size() + n > max) throw new IOException("Datei ist zu groß"); out.write(buffer, 0, n); }
        return out.toByteArray();
    }
    private HttpURLConnection connection(String url) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(20000); c.setReadTimeout(45000); c.setInstanceFollowRedirects(false);
        c.setRequestProperty("User-Agent", "Fahrklar/1.0 (personal learning; github.com/paulschenkenfelder31-debug/Lern-App)");
        return c;
    }
    private byte[] imageBytes(String url) throws IOException {
        String name = Uri.parse(url).getLastPathSegment();
        File folder = new File(getFilesDir(), "images"); folder.mkdirs();
        File file = new File(folder, name);
        if (file.exists()) try (InputStream in = new FileInputStream(file)) { return bounded(in, 8_000_000); }
        HttpURLConnection c = connection(url);
        try {
            if (c.getResponseCode() != 200) throw new IOException("Bild nicht verfügbar");
            byte[] bytes; try (InputStream in = c.getInputStream()) { bytes = bounded(in, 8_000_000); }
            if (bytes.length < 3 || (bytes[0] & 255) != 255 || (bytes[1] & 255) != 216) throw new IOException("Kein JPEG-Bild");
            synchronized (this) { AtomicFile f = new AtomicFile(file); FileOutputStream out = f.startWrite(); try { out.write(bytes); f.finishWrite(out); } catch(IOException e) { f.failWrite(out); throw e; } }
            return bytes;
        } finally { c.disconnect(); }
    }
    private String hash(String text) throws Exception {
        byte[] bytes = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
        StringBuilder s = new StringBuilder(); for (byte b : bytes) s.append(String.format(Locale.ROOT, "%02x", b & 255)); return s.toString();
    }
    private void event(String type, String message) {
        runOnUiThread(() -> { if (!isDestroyed()) web.evaluateJavascript("window.nativeEvent && window.nativeEvent("+JSONObject.quote(type)+","+JSONObject.quote(message)+")", null); });
    }
    private void sync() {
        if (syncing) return;
        syncing = true; event("sync", "Fragenkatalog wird geladen …");
        worker.execute(() -> {
            HttpURLConnection c = null;
            try {
                JSONObject old = new JSONObject(read("catalog.json", "{\"questions\":[],\"meta\":{}}"));
                JSONObject oldMeta = old.getJSONObject("meta");
                c = connection(SOURCE);
                if (oldMeta.has("etag")) c.setRequestProperty("If-None-Match", oldMeta.getString("etag"));
                int status = c.getResponseCode();
                if (status == 304 && old.getJSONArray("questions").length() > 0) {
                    oldMeta.put("checkedAt", System.currentTimeMillis()); write("catalog.json", old.toString());
                } else {
                    if (status != 200) throw new IOException("Quelle antwortet mit HTTP " + status);
                    String raw; try (InputStream in = c.getInputStream()) { raw = new String(bounded(in, 25_000_000), StandardCharsets.UTF_8); }
                    JSONArray questions = new JSONObject(raw).getJSONObject("result").getJSONObject("pageContext").getJSONArray("questions");
                    validate(questions);
                    if (old.getJSONArray("questions").length() > 0 && questions.length() < old.getJSONArray("questions").length() * .8) throw new IOException("Ungewöhnlich viele Fragen fehlen. Alter Katalog bleibt erhalten.");
                    JSONObject meta = new JSONObject();
                    String digest = hash(questions.toString());
                    meta.put("checkedAt", System.currentTimeMillis()); meta.put("changedAt", digest.equals(oldMeta.optString("hash")) ? oldMeta.optLong("changedAt") : System.currentTimeMillis());
                    meta.put("hash", digest); meta.put("count", questions.length()); meta.put("source", SOURCE);
                    if (c.getHeaderField("ETag") != null) meta.put("etag", c.getHeaderField("ETag"));
                    meta.put("serverModified", c.getHeaderField("Last-Modified"));
                    write("catalog.json", new JSONObject().put("questions", questions).put("meta", meta).toString());
                }
                event("updated", "Fragenkatalog geprüft und gespeichert.");
            } catch (Exception e) { event("error", "Aktualisierung fehlgeschlagen: " + e.getMessage() + " Dein gespeicherter Katalog bleibt erhalten."); }
            finally { if (c != null) c.disconnect(); syncing = false; }
        });
    }
    private void validate(JSONArray questions) throws Exception {
        if (questions.length() < 100 || questions.length() > 30000) throw new IOException("Unerwartete Kataloggröße");
        Set<Integer> ids = new HashSet<>();
        for (int i=0; i<questions.length(); i++) {
            JSONObject q = questions.getJSONObject(i);
            if (!ids.add(q.getInt("qst_id")) || q.getString("txt_text").trim().isEmpty() || q.getJSONArray("classes").length() == 0) throw new IOException("Ungültige Frage");
            JSONArray answers = q.getJSONArray("answers"); int correct = 0;
            if (answers.length() < 2 || answers.length() > 10) throw new IOException("Antworten unvollständig");
            for (int j=0; j<answers.length(); j++) { JSONObject a = answers.getJSONObject(j); a.getString("txt_text"); int flag = a.getInt("ans_correct"); if (flag!=0 && flag!=1) throw new IOException("Antwortschlüssel ungültig"); correct += flag; }
            if (correct == 0 || q.getInt("qst_value") < 0) throw new IOException("Antwortschlüssel fehlt");
        }
        for (int i=0; i<questions.length(); i++) { JSONObject q=questions.getJSONObject(i); int sub=q.optInt("qst_sub",0); if(sub>0 && !ids.contains(sub)) throw new IOException("Zusatzfrage fehlt"); }
    }
    public class Bridge {
        @JavascriptInterface public String loadState() { return read("state.json", "{}"); }
        @JavascriptInterface public boolean saveState(String state) {
            try { if (state.length()>30_000_000) return false; new JSONObject(state); write("state.json",state); return true; } catch(Exception e) { return false; }
        }
        @JavascriptInterface public void syncCatalog() { runOnUiThread(() -> sync()); }
        @JavascriptInterface public void openSource() { runOnUiThread(() -> startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.f-online.app/at/fragenkatalog/alle-fragen/")))); }
        @JavascriptInterface public void exportState(String data) {
            runOnUiThread(() -> { exportText=data; Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT); i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("application/json"); i.putExtra(Intent.EXTRA_TITLE,"fahrklar-sicherung.json"); startActivityForResult(i,EXPORT); });
        }
        @JavascriptInterface public void importState() { runOnUiThread(() -> { Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT); i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("application/json"); startActivityForResult(i,IMPORT); }); }
        @JavascriptInterface public void cacheImages(String modulesJson) {
            if(syncing) return; syncing=true;
            worker.execute(() -> {
                int done=0, failed=0;
                try {
                    JSONArray selected=new JSONArray(modulesJson); Set<Integer> modules=new HashSet<>(); for(int i=0;i<selected.length();i++) modules.add(selected.getInt(i));
                    JSONArray qs=new JSONObject(read("catalog.json","{}")).getJSONArray("questions"); Set<Integer> images=new LinkedHashSet<>();
                    for(int i=0;i<qs.length();i++) { JSONObject q=qs.getJSONObject(i); boolean include=false; JSONArray cs=q.getJSONArray("classes"); for(int j=0;j<cs.length();j++) if(modules.contains(cs.getInt(j))) include=true;
                        if(!include) continue; int img=q.optInt("qst_image",0); if(img>0) images.add(img);
                        JSONArray as=q.getJSONArray("answers"); for(int j=0;j<as.length();j++) {img=as.getJSONObject(j).optInt("ans_image",0); if(img>0) images.add(img);}
                    }
                    for(int id:images) { if(Thread.currentThread().isInterrupted()) break; try {imageBytes("https://img.f-online.at/"+id+".jpg");} catch(Exception e) {failed++;} done++; if(done%10==0) event("sync","Bilder: "+done+" / "+images.size()); }
                    event("done","Bilder geprüft: "+done+". Nicht verfügbar: "+failed+".");
                } catch(Exception e) {event("error","Bilder konnten nicht geladen werden.");} finally {syncing=false;}
            });
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request,result,data); if(result!=RESULT_OK || data==null || data.getData()==null)return;
        Uri uri=data.getData();
        worker.execute(() -> {try {
            if(request==EXPORT && exportText!=null) {try(OutputStream out=getContentResolver().openOutputStream(uri)) {out.write(exportText.getBytes(StandardCharsets.UTF_8));} exportText=null; event("done","Sicherung gespeichert.");}
            if(request==IMPORT) {String text; try(InputStream in=getContentResolver().openInputStream(uri)) {text=new String(bounded(in,30_000_000),StandardCharsets.UTF_8);} event("import",text);}
        } catch(Exception e) {event("error","Datei konnte nicht verarbeitet werden.");}});
    }
    @Override public void onBackPressed() { web.evaluateJavascript("window.goBack ? window.goBack() : false", value -> { if ("false".equals(value)) finish(); }); }
    @Override protected void onPause() { web.evaluateJavascript("window.pauseApp && window.pauseApp()",null); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if(web!=null) web.evaluateJavascript("window.resumeApp && window.resumeApp()",null); }
    @Override protected void onDestroy() {worker.shutdownNow(); web.removeJavascriptInterface("Native"); web.destroy(); super.onDestroy();}
}
