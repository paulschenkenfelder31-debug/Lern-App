package at.lernapp;

import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = {26,35})
public class GeminiTest {
    @Test public void longOpaqueKeysArePreservedAndHeaderInjectionRejected() throws Exception {
        String key="auth_"+String.join("",java.util.Collections.nCopies(1500,"a"))+"+/=.";
        assertEquals(key,GeminiClient.normalizeKey("  "+key+"\n"));
        assertEquals("short-opaque-key",GeminiClient.normalizeKey("short-opaque-key"));
        assertThrows(GeminiClient.UserError.class,()->GeminiClient.normalizeKey("key\r\nx-header: value"));
        assertThrows(GeminiClient.UserError.class,()->GeminiClient.normalizeKey("two parts"));
        assertThrows(GeminiClient.UserError.class,()->GeminiClient.normalizeKey("   "));
        assertThrows(GeminiClient.UserError.class,()->GeminiClient.normalizeKey(String.join("",java.util.Collections.nCopies(8193,"a"))));
    }
    private JSONObject question() throws Exception {
        return new JSONObject().put("text","Synthetische Lernfrage").put("image",12)
            .put("attempts","MUST_NOT_SEND").put("apiKey","MUST_NOT_SEND")
            .put("answers",new JSONArray().put(new JSONObject().put("text","Antwort A").put("correct",true))
                .put(new JSONObject().put("text","Antwort B").put("correct",false).put("image",13)));
    }
    @Test public void payloadIncludesAnswerKeyAndLabeledImagesButNoPrivateFields() throws Exception {
        JSONObject request=GeminiClient.payload(question(), id -> new byte[]{(byte)255,(byte)216,0});
        String raw=request.toString();assertFalse(raw.contains("MUST_NOT_SEND"));
        assertTrue(raw.contains("laut Katalog richtig"));assertTrue(raw.contains("laut Katalog falsch"));
        JSONArray parts=request.getJSONArray("contents").getJSONObject(0).getJSONArray("parts");
        assertEquals(5,parts.length());assertEquals("Abbildung zur Frage:",parts.getJSONObject(1).getString("text"));
        assertEquals("Abbildung zu Antwort 2:",parts.getJSONObject(3).getString("text"));
        assertEquals("image/jpeg",parts.getJSONObject(2).getJSONObject("inlineData").getString("mimeType"));
    }
    @Test public void unavailableImagesRejectTheWholeRequest() throws Exception {
        assertThrows(Exception.class,()->GeminiClient.payload(question(),id -> new byte[0]));
        JSONObject bad=question();bad.put("answers",new JSONArray());
        assertThrows(Exception.class,()->GeminiClient.payload(bad,id -> new byte[0]));
    }
    @Test public void responseRequiresCompleteTextAndExcludesThoughtParts() throws Exception {
        JSONObject candidate=new JSONObject().put("finishReason","STOP").put("content",new JSONObject().put("parts",new JSONArray()
            .put(new JSONObject().put("thought",true).put("text","internal"))
            .put(new JSONObject().put("text","Kurze Erklärung."))));
        JSONObject result=new JSONObject().put("candidates",new JSONArray().put(candidate));
        assertEquals("Kurze Erklärung.",GeminiClient.explanation(result));
        candidate.put("finishReason","MAX_TOKENS");assertThrows(Exception.class,()->GeminiClient.explanation(result));
        assertThrows(Exception.class,()->GeminiClient.explanation(new JSONObject()));
        assertTrue(GeminiClient.httpError(429).contains("Kontingent"));
        assertTrue(GeminiClient.httpError(403).contains("API-Key"));
    }
    @Test public void selectsAnAvailableTextFlashModelAndRejectsMediaModels() throws Exception {
        JSONArray models=new JSONArray()
            .put(new JSONObject().put("name","models/gemini-3.5-flash-tts").put("supportedGenerationMethods",new JSONArray().put("generateContent")))
            .put(new JSONObject().put("name","models/gemini-pro").put("supportedGenerationMethods",new JSONArray().put("generateContent")))
            .put(new JSONObject().put("name","models/gemini-2.5-flash-lite").put("supportedGenerationMethods",new JSONArray().put("generateContent")))
            .put(new JSONObject().put("name","models/gemini-3.7-flash").put("supportedGenerationMethods",new JSONArray().put("generateContent")));
        assertEquals("models/gemini-3.7-flash",GeminiClient.selectModel(new JSONObject().put("models",models)));
        models.remove(3);assertEquals("models/gemini-2.5-flash-lite",GeminiClient.selectModel(new JSONObject().put("models",models)));
        models.remove(2);assertThrows(GeminiClient.UserError.class,()->GeminiClient.selectModel(new JSONObject().put("models",models)));
    }
    @Test public void currentInteractionsPayloadPreservesTextAndImagesAndDoesNotStore() throws Exception {
        JSONObject request=GeminiClient.interactionPayload(GeminiClient.payload(question(),id -> new byte[]{(byte)255,(byte)216,0}));
        assertEquals("gemini-flash-latest",request.getString("model"));assertFalse(request.getBoolean("store"));
        JSONArray input=request.getJSONArray("input");assertEquals("text",input.getJSONObject(0).getString("type"));
        assertEquals("image",input.getJSONObject(2).getString("type"));assertEquals("image/jpeg",input.getJSONObject(2).getString("mime_type"));
        assertFalse(request.toString().contains("inlineData"));
        JSONObject response=new JSONObject().put("status","completed").put("steps",new JSONArray()
            .put(new JSONObject().put("type","thought").put("content",new JSONArray().put(new JSONObject().put("type","text").put("text","intern"))))
            .put(new JSONObject().put("type","model_output").put("content",new JSONArray().put(new JSONObject().put("type","text").put("text","Erklärung")))));
        assertEquals("Erklärung",GeminiClient.interactionExplanation(response));
    }
}
