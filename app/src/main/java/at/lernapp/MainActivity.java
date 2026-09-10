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
    private GeminiClient gemini;
    private final ExecutorService aiWorker = Executors.newSingleThreadExecutor();
    private final java.util.concurrent.atomic.AtomicBoolean aiBusy = new java.util.concurrent.atomic.AtomicBoolean();

    private volatile boolean syncing;
    private String exportText;
    private static final int EXPORT = 10, IMPORT = 11;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        gemini = new GeminiClient(this);
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
                        if (path != null && path.matches("/(index.html|app.js|core.js|icons.js|style.css|firebase-config.js|cloud.js)")) {
                            String mime = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html";
                            return new WebResourceResponse(mime,"UTF-8",200,"OK",Collections.emptyMap(),getAssets().open(path.substring(1)));
                        }
                    }
                    if ("https".equals(uri.getScheme()) && ("identitytoolkit.googleapis.com".equals(uri.getHost()) || "securetoken.googleapis.com".equals(uri.getHost()) || "firestore.googleapis.com".equals(uri.getHost()))) {
                        return null;
                    }
                    if ("https".equals(uri.getScheme()) && "img.f-online.at".equals(uri.getHost()) && uri.getPath().matches("/[0-9]+\\.jpg")) {
                        return new WebResourceResponse("image/jpeg", null, 200, "OK", Collections.emptyMap(), new ByteArrayInputStream(imageBytes(uri.toString())));
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
    private WebResourceResponse json(String s) { return new WebResourceResponse("application/json", "UTF-8", 200, "OK", Collections.emptyMap(), new ByteArrayInputStream(s.getBytes(StandardCharsets.UTF_8))); }
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

    private static final String RELEASES = "https://github.com/paulschenkenfelder31-debug/Lern-App/releases/latest";
    private volatile boolean checkingUpdate;
    static JSONObject updateResult(JSONObject release, int installed) throws Exception {
        String tag = release.getString("tag_name");
        if (!tag.matches("(test|version)-[1-9][0-9]{0,8}") || release.optBoolean("draft") || release.optBoolean("prerelease"))
            throw new IOException("Unbekannte Version");
        int version = Integer.parseInt(tag.substring(tag.indexOf('-') + 1));
        JSONArray assets = release.getJSONArray("assets");
        boolean apk = false;
        String expected = tag.startsWith("version-") ? "Fahrklar.apk" : "Fahrklar-Test.apk";
        for (int i=0; i<assets.length(); i++) {
            JSONObject asset = assets.getJSONObject(i);
            String url = "https://github.com/paulschenkenfelder31-debug/Lern-App/releases/download/" + tag + "/" + expected;
            if (expected.equals(asset.optString("name")) && url.equals(asset.optString("browser_download_url")) && asset.optLong("size") > 0) apk = true;
        }
        if (!apk) throw new IOException("Noch keine APK veröffentlicht");
        boolean newer = version > installed;
        return new JSONObject().put("available", newer).put("message", newer
            ? "Version 1.0." + version + " ist verfügbar. Sichere deinen Lernstand vor dem Wechsel."
            : "Du verwendest bereits die aktuelle oder eine neuere Version.");
    }
    private void checkUpdate() {
        if (checkingUpdate) return;
        checkingUpdate = true;
        worker.execute(() -> {
            HttpURLConnection c = null;
            try {
                c = connection("https://api.github.com/repos/paulschenkenfelder31-debug/Lern-App/releases/latest");
                c.setRequestProperty("Accept", "application/vnd.github+json");
                if(c.getResponseCode()!=200) throw new IOException("GitHub ist gerade nicht erreichbar");
                JSONObject release;
                try(InputStream in=c.getInputStream()) { release=new JSONObject(new String(bounded(in,1_000_000),StandardCharsets.UTF_8)); }
                event("app-update", updateResult(release, BuildConfig.VERSION_CODE).toString());
            } catch(Exception e) { event("app-update-error", "Updates konnten nicht geprüft werden. Prüfe deine Internetverbindung und versuche es erneut."); }
            finally { if(c!=null)c.disconnect();checkingUpdate=false; }
        });
    }

    private void geminiKeyDialog() {
        android.widget.EditText input=new android.widget.EditText(this);
        input.setHint("Gemini-API-Key");
        input.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD|android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        input.setSingleLine(true);
        input.setHorizontallyScrolling(true);
        input.setFilters(new android.text.InputFilter[0]);
        input.setImportantForAutofill(android.view.View.IMPORTANT_FOR_AUTOFILL_NO);
        android.widget.LinearLayout fields=new android.widget.LinearLayout(this);
        fields.setOrientation(android.widget.LinearLayout.VERTICAL);
        int padding=(int)(20*getResources().getDisplayMetrics().density);
        fields.setPadding(padding,0,padding,0);
        fields.addView(input,new android.widget.LinearLayout.LayoutParams(-1,-2));
        android.widget.TextView count=new android.widget.TextView(this);
        count.setText("0 Zeichen · lange Keys werden vollständig übernommen");
        fields.addView(count);
        input.addTextChangedListener(new android.text.TextWatcher(){
            public void beforeTextChanged(CharSequence s,int start,int length,int after){}
            public void onTextChanged(CharSequence s,int start,int before,int length){count.setText(s.length()+" Zeichen · Eingabe bleibt verborgen");}
            public void afterTextChanged(android.text.Editable s){}
        });
        android.widget.Button paste=new android.widget.Button(this);
        paste.setText("Aus Zwischenablage einfügen");
        fields.addView(paste);
        paste.setOnClickListener(v -> {
            android.content.ClipboardManager clipboard=(android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
            android.content.ClipData clip=clipboard==null?null:clipboard.getPrimaryClip();
            CharSequence text=clip!=null&&clip.getItemCount()>0?clip.getItemAt(0).getText():null;
            if(text==null){input.setError("Kein Text in der Zwischenablage. Kopiere zuerst deinen API-Key.");return;}
            input.setText(text);input.setSelection(input.length());
        });
        android.app.AlertDialog dialog=new android.app.AlertDialog.Builder(this)
            .setTitle("Gemini einrichten")
            .setMessage("Füge nur den API-Key aus Google AI Studio ein – keine JSON-Datei, keinen OAuth-Token und keinen ganzen Befehl. Bei „Einfach erklären“ werden die Frage, Antworten, Lösung und Bilder an Google Gemini gesendet. Es gilt dein Gemini-Tarif; Anfragen können Kosten verursachen. Dein Lernverlauf wird nicht übertragen. Der Key wird auf diesem Gerät verschlüsselt gespeichert und nicht in Sicherungen exportiert.")
            .setView(fields).setNegativeButton("Abbrechen",null).setPositiveButton("Speichern",null).create();
        dialog.setOnShowListener(ignored -> {
            dialog.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);
            dialog.getButton(android.app.AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                try { gemini.saveKey(input.getText().toString());input.setText("");dialog.dismiss();event("ai-key","saved"); }
                catch(GeminiClient.UserError e) { input.setError(e.getMessage()); }
                catch(Exception e) { input.setError("Key konnte nicht verschlüsselt gespeichert werden. Bitte erneut versuchen."); }
            });
        });
        dialog.setOnDismissListener(ignored -> input.setText(""));
        dialog.show();
    }
    private void aiResult(String id, String value, boolean success) {
        try {event(success?"ai-result":"ai-error",new JSONObject().put("id",id).put("text",value).toString());}
        catch(JSONException ignored) {}
    }
    private void aiTestResult(String value, boolean success) {
        event(success?"ai-test":"ai-test-error",value);
    }
    public class Bridge {
        @JavascriptInterface public void setKeepAwake(boolean enabled) {
            runOnUiThread(() -> { if(web!=null) web.setKeepScreenOn(enabled); });
        }
        @JavascriptInterface public void feedback(String kind) {
            if(!"correct".equals(kind)&&!"wrong".equals(kind))return;
            runOnUiThread(() -> {
                if(web!=null) web.performHapticFeedback("correct".equals(kind)
                    ? android.view.HapticFeedbackConstants.KEYBOARD_TAP
                    : android.view.HapticFeedbackConstants.LONG_PRESS);
            });
        }
        @JavascriptInterface public boolean hasGeminiKey() { return gemini.hasKey(); }
        @JavascriptInterface public void configureGemini() { runOnUiThread(() -> geminiKeyDialog()); }
        @JavascriptInterface public void deleteGeminiKey() {
            runOnUiThread(() -> new android.app.AlertDialog.Builder(MainActivity.this).setTitle("Gemini-Key entfernen?")
                .setMessage("Die KI-Funktion wird deaktiviert. Lernstand und Verlauf bleiben gespeichert.")
                .setNegativeButton("Abbrechen",null).setPositiveButton("Entfernen",(d,w) -> {
                    try {gemini.deleteKey();event("ai-key","deleted");}
                    catch(Exception e){event("ai-key-error","Key konnte nicht vollständig entfernt werden. Bitte erneut versuchen.");}
                }).show());
        }
        @JavascriptInterface public void explainQuestion(String requestId, String questionJson) {
            if(requestId==null||!requestId.matches("[A-Za-z0-9:-]{1,120}"))return;
            if(questionJson==null||questionJson.length()>50000){aiResult(requestId,"Die Frage ist zu groß.",false);return;}
            if(!aiBusy.compareAndSet(false,true)){aiResult(requestId,"Eine Erklärung wird bereits geladen.",false);return;}
            aiWorker.execute(() -> {
                try { aiResult(requestId,gemini.explain(new JSONObject(questionJson),id -> imageBytes("https://img.f-online.at/"+id+".jpg")),true); }
                catch(GeminiClient.UserError e){aiResult(requestId,e.getMessage(),false);}
                catch(Exception e){aiResult(requestId,"Erklärung konnte nicht geladen werden. Prüfe Internet und API-Key; auch benötigte Bilder müssen verfügbar sein.",false);}
                finally {aiBusy.set(false);}
            });
        }
        @JavascriptInterface public void testGemini() {
            if(!aiBusy.compareAndSet(false,true)){aiTestResult("Eine Gemini-Anfrage läuft bereits.",false);return;}
            aiWorker.execute(() -> {
                try {aiTestResult(gemini.testConnection(),true);}
                catch(GeminiClient.UserError e){aiTestResult(e.getMessage(),false);}
                catch(Exception e){aiTestResult("Verbindungstest fehlgeschlagen. Prüfe Internet und API-Key.",false);}
                finally {aiBusy.set(false);}
            });
        }

        @JavascriptInterface public String appInfo() {
            try { return new JSONObject().put("version",BuildConfig.VERSION_NAME).put("stable",BuildConfig.STABLE_SIGNING).toString(); }
            catch(JSONException e) { return "{}"; }
        }
        @JavascriptInterface public void checkUpdate() { runOnUiThread(() -> MainActivity.this.checkUpdate()); }
        @JavascriptInterface public void openUpdate() {
            runOnUiThread(() -> { try { startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(RELEASES))); }
                catch(android.content.ActivityNotFoundException e) { event("app-update-error","Zum Öffnen des Updates wird ein Browser benötigt."); } });
        }

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
    @Override protected void onDestroy() {worker.shutdownNow(); aiWorker.shutdownNow(); web.setKeepScreenOn(false); web.removeJavascriptInterface("Native"); web.destroy(); super.onDestroy();}
}
