package com.icecreamboat.captain;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;

public class MainActivity extends Activity {
    private static final int REQ_LOCATION = 10;
    private static final int REQ_NOTIFICATIONS = 11;

    private FirebaseAuth auth;
    private EditText emailInput;
    private EditText passwordInput;
    private EditText noteInput;
    private EditText customInput;
    private TextView loginStatus;
    private TextView trackingStatus;
    private LinearLayout appPanel;
    private LinearLayout loginPanel;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        auth = FirebaseAuth.getInstance();
        buildUi();
        updateAuthUi(auth.getCurrentUser());
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(36, 42, 36, 42);
        scroll.addView(root);

        TextView title = new TextView(this);
        title.setText("Ice Cream Boat Captain");
        title.setTextSize(26);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        root.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("Uploads live location to Firebase boat/current.");
        subtitle.setTextSize(15);
        subtitle.setPadding(0, 8, 0, 24);
        root.addView(subtitle);

        loginPanel = new LinearLayout(this);
        loginPanel.setOrientation(LinearLayout.VERTICAL);
        root.addView(loginPanel);

        emailInput = new EditText(this);
        emailInput.setHint("Captain email");
        emailInput.setSingleLine(true);
        loginPanel.addView(emailInput);

        passwordInput = new EditText(this);
        passwordInput.setHint("Password");
        passwordInput.setSingleLine(true);
        passwordInput.setInputType(0x00000081);
        loginPanel.addView(passwordInput);

        Button loginBtn = new Button(this);
        loginBtn.setText("Sign in");
        loginPanel.addView(loginBtn);
        loginBtn.setOnClickListener(v -> signIn());

        loginStatus = new TextView(this);
        loginStatus.setPadding(0, 12, 0, 20);
        loginPanel.addView(loginStatus);

        appPanel = new LinearLayout(this);
        appPanel.setOrientation(LinearLayout.VERTICAL);
        root.addView(appPanel);

        trackingStatus = new TextView(this);
        trackingStatus.setTextSize(17);
        trackingStatus.setTypeface(Typeface.DEFAULT_BOLD);
        trackingStatus.setPadding(0, 12, 0, 12);
        appPanel.addView(trackingStatus);

        noteInput = new EditText(this);
        noteInput.setHint("Optional note / announcement");
        appPanel.addView(noteInput);

        addStatusButton("Available now", "available", "Available now", 0L);
        addStatusButton("Back in 15 minutes", "paused", "Back in 15 minutes", 15L * 60L * 1000L);
        addStatusButton("Back in 30 minutes", "paused", "Back in 30 minutes", 30L * 60L * 1000L);
        addStatusButton("Done for today", "done", "Done for today", 0L);

        customInput = new EditText(this);
        customInput.setHint("Custom status");
        appPanel.addView(customInput);
        Button saveCustom = new Button(this);
        saveCustom.setText("Save custom status");
        appPanel.addView(saveCustom);
        saveCustom.setOnClickListener(v -> saveCustomStatus());

        Button startBtn = new Button(this);
        startBtn.setText("Start background tracking");
        appPanel.addView(startBtn);
        startBtn.setOnClickListener(v -> startTracking());

        Button stopBtn = new Button(this);
        stopBtn.setText("Stop tracking");
        appPanel.addView(stopBtn);
        stopBtn.setOnClickListener(v -> stopTracking());

        Button permissionBtn = new Button(this);
        permissionBtn.setText("Open app settings for Always Allow location / battery settings");
        appPanel.addView(permissionBtn);
        permissionBtn.setOnClickListener(v -> openAppSettings());

        Button logoutBtn = new Button(this);
        logoutBtn.setText("Sign out");
        appPanel.addView(logoutBtn);
        logoutBtn.setOnClickListener(v -> {
            stopTracking();
            auth.signOut();
            updateAuthUi(null);
        });

        TextView help = new TextView(this);
        help.setGravity(Gravity.START);
        help.setPadding(0, 20, 0, 0);
        help.setText("For best reliability: allow location all the time and disable battery optimization for this app.");
        appPanel.addView(help);

        setContentView(scroll);
    }

    private void addStatusButton(String label, String status, String headline, long pauseForMillis) {
        Button btn = new Button(this);
        btn.setText(label);
        appPanel.addView(btn);
        btn.setOnClickListener(v -> {
            long pauseUntil = pauseForMillis > 0L ? System.currentTimeMillis() + pauseForMillis : 0L;
            BoatStateStore.save(this, headline, status, noteInput.getText().toString().trim(), pauseUntil);
            trackingStatus.setText("Status saved: " + headline);
        });
    }

    private void signIn() {
        String email = emailInput.getText().toString().trim();
        String password = passwordInput.getText().toString();
        loginStatus.setText("Signing in...");
        auth.signInWithEmailAndPassword(email, password)
                .addOnSuccessListener(result -> updateAuthUi(result.getUser()))
                .addOnFailureListener(e -> loginStatus.setText("Sign-in failed: " + e.getMessage()));
    }

    private void updateAuthUi(FirebaseUser user) {
        boolean signedIn = user != null;
        loginPanel.setVisibility(signedIn ? View.GONE : View.VISIBLE);
        appPanel.setVisibility(signedIn ? View.VISIBLE : View.GONE);
        if (signedIn) {
            trackingStatus.setText("Signed in. Choose a status, then start tracking.");
        }
    }

    private void saveCustomStatus() {
        String custom = customInput.getText().toString().trim();
        if (custom.length() == 0) {
            trackingStatus.setText("Enter a custom status first.");
            return;
        }
        BoatStateStore.save(this, custom, "custom", noteInput.getText().toString().trim(), 0L);
        trackingStatus.setText("Status saved: " + custom);
    }

    private void startTracking() {
        if (auth.getCurrentUser() == null) {
            trackingStatus.setText("Sign in first.");
            return;
        }
        if (!hasLocationPermission()) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATIONS);
            return;
        }
        Intent intent = new Intent(this, LocationUploadService.class);
        intent.setAction(LocationUploadService.ACTION_START);
        ContextCompat.startForegroundService(this, intent);
        trackingStatus.setText("Tracking started. You may lock the screen.");
    }

    private void stopTracking() {
        Intent intent = new Intent(this, LocationUploadService.class);
        intent.setAction(LocationUploadService.ACTION_STOP);
        startService(intent);
        trackingStatus.setText("Tracking stopped.");
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void openAppSettings() {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + getPackageName()));
        startActivity(intent);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_LOCATION || requestCode == REQ_NOTIFICATIONS) {
            startTracking();
        }
    }
}
