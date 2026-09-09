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
}
