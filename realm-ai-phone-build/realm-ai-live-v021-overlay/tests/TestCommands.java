import com.veilforge.realmagent.CommandCatalog;
public class TestCommands {
    static void eq(String actual, String expected) { if (!actual.equals(expected)) throw new AssertionError(actual + " != " + expected); }
    public static void main(String[] args) {
        eq(CommandCatalog.clean(" !vf follow me "), "follow me");
        eq(CommandCatalog.clean(" stop "), "stop");
        eq(CommandCatalog.normalizeBaseUrl("https://machine.example.ts.net/"), "https://machine.example.ts.net");
        try { CommandCatalog.normalizeBaseUrl("http://192.168.0.1:8765"); throw new AssertionError("Allowed HTTP"); }
        catch (IllegalArgumentException expected) { }
        try { CommandCatalog.clean(" "); throw new AssertionError("Allowed empty command"); }
        catch (IllegalArgumentException expected) { }
        System.out.println("PASS: 5 Android-independent command and URL checks");
    }
}
