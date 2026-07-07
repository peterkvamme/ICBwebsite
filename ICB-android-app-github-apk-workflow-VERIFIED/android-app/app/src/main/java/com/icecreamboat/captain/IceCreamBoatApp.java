package com.icecreamboat.captain;

import android.app.Application;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

public class IceCreamBoatApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();

        if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseOptions options = new FirebaseOptions.Builder()
                    .setApiKey("AIzaSyBKihTX3k-Sp2xJvtBkRm6Ger_lkTGAHYA")
                    .setApplicationId("1:1015342157676:web:2d6a47ecf8b3c369b1ad49")
                    .setProjectId("ice-cream-boat-d2650")
                    .setDatabaseUrl("https://ice-cream-boat-d2650-default-rtdb.firebaseio.com")
                    .setStorageBucket("ice-cream-boat-d2650.firebasestorage.app")
                    .build();
            FirebaseApp.initializeApp(this, options);
        }
    }
}
