package com.veilforge.realmagent;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Read-only adapter from the EXISTING bundled/live /catalog descriptor schema.
 * No duplicate command registry and no filtering of future IDs.
 * A descriptor being advertised only means the user may attempt the command;
 * game-state validation and actual execution remain authoritative in the bot.
 */
public final class RovekinCatalogAdapter {
    private RovekinCatalogAdapter() {}

    public static List<RovekinFeatureContract.Skill> fromLiveCatalog(JSONArray data) {
        if (data == null) return Collections.emptyList();
        List<RovekinFeatureContract.Skill> results = new ArrayList<>();
        for (int i=0;i<data.length();i++) {
            JSONObject item=data.optJSONObject(i);
            if (item==null) continue;
            String id=item.optString("id","").trim();
            if (id.isEmpty()) continue;
            String label=item.optString("label",id);
            String group=item.optString("category",item.optString("group",""));
            boolean advertised=item.optBoolean("available",true)
                && item.optBoolean("enabled",true);
            results.add(new RovekinFeatureContract.Skill(id,label,group,advertised));
        }
        return Collections.unmodifiableList(results);
    }
}
