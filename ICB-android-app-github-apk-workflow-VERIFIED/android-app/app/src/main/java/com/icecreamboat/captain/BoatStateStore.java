package com.icecreamboat.captain;

import android.content.Context;
import android.content.SharedPreferences;

public final class BoatStateStore {
    private static final String PREFS = "boat_state";

    private BoatStateStore() {}

    public static void save(Context context, String headline, String status, String note, long pauseUntil) {
        SharedPreferences.Editor editor = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        editor.putString("headline", headline);
        editor.putString("status", status);
        editor.putString("note", note == null ? "" : note);
        editor.putLong("pauseUntil", pauseUntil);
        editor.apply();
    }

    public static BoatState load(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return new BoatState(
                prefs.getString("headline", "Available now"),
                prefs.getString("status", "available"),
                prefs.getString("note", ""),
                prefs.getLong("pauseUntil", 0L)
        );
    }

    public static final class BoatState {
        public final String headline;
        public final String status;
        public final String note;
        public final long pauseUntil;

        public BoatState(String headline, String status, String note, long pauseUntil) {
            this.headline = headline;
            this.status = status;
            this.note = note;
            this.pauseUntil = pauseUntil;
        }
    }
}
