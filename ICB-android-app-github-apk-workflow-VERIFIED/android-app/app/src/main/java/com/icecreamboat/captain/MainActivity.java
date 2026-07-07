package com.icecreamboat.captain;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;

import java.util.HashMap;
import java.util.Map;

public class MainActivity extends android.app.Activity {
    private static final int LOCATION_PERMISSION_REQUEST = 41;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 42;

    private FirebaseAuth auth;
    private DatabaseReference boatRef;
    private LinearLayout loginLayout;
    private LinearLayout dashboardLayout;
    private TextView statusText;
    private TextView helpText;
    private EditText emailInput;
    private EditText passwordInput;
    private EditText noteInput;
    private EditText customStatusInput;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        auth = FirebaseAuth.getInstance();
        boatRef = FirebaseDatabase.getInstance().getReference("boat/current");
        setContentView(buildContent());
        refreshAuthUi();
        requestNotificationPermissionIfNeeded();
    }

    private View buildContent() {
        ScrollView scrollView = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(32, 48, 32, 48);
        scrollView.addView(root);

        TextView title = new TextView(this);
        title.setText("Ice Cream Boat Captain");
        title.setTextSize(26);
        title.setPadding(0, 0, 0, 16);
        root.addView(title);

        loginLayout = new LinearLayout(this);
        loginLayout.setOrientation(LinearLayout.VERTICAL);
        root.addView(loginLayout);

        emailInput = new EditText(this);
        emailInput.setHint("Email");
        emailInput.setInputType(InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        loginLayout.addView(emailInput);

        passwordInput = new EditText(this);
        passwordInput.setHint("Password");
        passwordInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        loginLayout.addView(passwordInput);

        Button loginButton = new Button(this);
        loginButton.setText("Login");
        loginButton.setOnClickListener(v -> login());
        loginLayout.addView(loginButton);

        dashboardLayout = new LinearLayout(this);
        dashboardLayout.setOrientation(LinearLayout.VERTICAL);
        dashboardLayout.setVisibility(View.GONE);
        root.addView(dashboardLayout);

        statusText = new TextView(this);
        statusText.setTextSize(20);
        statusText.setPadding(0, 12, 0, 12);
        dashboardLayout.addView(statusText);

        helpText = new TextView(this);
        helpText.setText("Use Start Sharing before locking the phone. Android will keep a notification visible while location sharing is active.");
        helpText.setPadding(0, 0, 0, 18);
        dashboardLayout.addView(helpText);

        noteInput = new EditText(this);
        noteInput.setHint("Customer announcement");
        dashboardLayout.addView(noteInput);

        customStatusInput = new EditText(this);
        customStatusInput.setHint("Custom status, e.g. Available near Bar Harbor");
        dashboardLayout.addView(customStatusInput);

        addButton(dashboardLayout, "Start Sharing Location", v -> startSharing());
        addButton(dashboardLayout, "Stop Sharing", v -> stopSharing());
        addButton(dashboardLayout, "Available Now", v -> setStatus("Available now", "available", 0));
        addButton(dashboardLayout, "Back in 30", v -> setStatus("Back in 30 minutes", "paused", 30));
        addButton(dashboardLayout, "Back in 1 Hour", v -> setStatus("Back in 1 hour", "paused", 60));
        addButton(dashboardLayout, "Back in 2 Hours", v -> setStatus("Back in 2 hours", "paused", 120));
        addButton(dashboardLayout, "Starting Soon", v -> setStatus("Starting soon", "starting_soon", 0));
        addButton(dashboardLayout, "Weather Delay", v -> setStatus("Weather delay", "weather_delay", 0));
        addButton(dashboardLayout, "Done Today", v -> setStatus("Done for today", "done", 0));
        addButton(dashboardLayout, "Set Custom Status", v -> {
            String custom = customStatusInput.getText().toString().trim();
            if (!custom.isEmpty()) setStatus(custom, "custom", 0);
        });
        addButton(dashboardLayout, "Save Announcement", v -> saveAnnouncement());
        addButton(dashboardLayout, "Open Background Location Settings", v -> openAppSettings());
        addButton(dashboardLayout, "Sign Out", v -> { auth.signOut(); refreshAuthUi(); });

        return scrollView;
    }

    private void addButton(LinearLayout parent, String text, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(text);
        button.setOnClickListener(listener);
        parent.addView(button);
    }

    private void login() {
        String email = emailInput.getText().toString().trim();
        String password = passwordInput.getText().toString();
        if (email.isEmpty() || password.isEmpty()) {
            toast("Enter email and password.");
            return;
        }
        auth.signInWithEmailAndPassword(email, password)
                .addOnSuccessListener(result -> refreshAuthUi())
                .addOnFailureListener(error -> toast(error.getMessage()));
    }

    private void refreshAuthUi() {
        boolean signedIn = auth.getCurrentUser() != null;
        loginLayout.setVisibility(signedIn ? View.GONE : View.VISIBLE);
        dashboardLayout.setVisibility(signedIn ? View.VISIBLE : View.GONE);
        if (signedIn) statusText.setText("Signed in. Not tracking.");
    }

    private void startSharing() {
        if (auth.getCurrentUser() == null) {
            toast("Login first.");
            return;
        }
        if (!hasFineLocationPermission()) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_PERMISSION_REQUEST);
            return;
        }
        BoatStateStore.BoatState state = BoatStateStore.load(this);
        if (state.status.equals("done")) {
            BoatStateStore.save(this, "Available now", "available", noteInput.getText().toString().trim(), 0L);
        }
        Intent intent = new Intent(this, LocationUploadService.class);
        intent.setAction(LocationUploadService.ACTION_START);
        ContextCompat.startForegroundService(this, intent);
        statusText.setText("Tracking active. You can lock the phone.");
    }

    private void stopSharing() {
        Intent intent = new Intent(this, LocationUploadService.class);
        intent.setAction(LocationUploadService.ACTION_STOP);
        ContextCompat.startForegroundService(this, intent);
        statusText.setText("Location sharing stopped.");
    }

    private void setStatus(String headline, String status, int pauseMinutes) {
        long pauseUntil = pauseMinutes > 0 ? System.currentTimeMillis() + pauseMinutes * 60_000L : 0L;
        String note = noteInput.getText().toString().trim();
        BoatStateStore.save(this, headline, status, note, pauseUntil);
        uploadStatusOnly(headline, status, note, pauseUntil);
        statusText.setText(headline);
    }

    private void saveAnnouncement() {
        BoatStateStore.BoatState current = BoatStateStore.load(this);
        String note = noteInput.getText().toString().trim();
        BoatStateStore.save(this, current.headline, current.status, note, current.pauseUntil);
        uploadStatusOnly(current.headline, current.status, note, current.pauseUntil);
        toast("Announcement saved.");
    }

    private void uploadStatusOnly(String headline, String status, String note, long pauseUntil) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("headline", headline);
        payload.put("status", status);
        payload.put("note", note);
        payload.put("pauseUntil", pauseUntil == 0L ? null : pauseUntil);
        payload.put("updatedAt", System.currentTimeMillis());
        boatRef.updateChildren(payload);
    }

    private boolean hasFineLocationPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
        }
    }

    private void openAppSettings() {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + getPackageName()));
        startActivity(intent);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_REQUEST && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            startSharing();
        }
    }

    private void toast(String message) {
        Toast.makeText(this, message == null ? "Something went wrong." : message, Toast.LENGTH_LONG).show();
    }
}
