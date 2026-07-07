package com.icecreamboat.captain;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;

import java.util.HashMap;
import java.util.Map;

public class LocationUploadService extends Service {
    public static final String ACTION_START = "com.icecreamboat.captain.START";
    public static final String ACTION_STOP = "com.icecreamboat.captain.STOP";
    private static final String CHANNEL_ID = "location_upload";
    private static final int NOTIFICATION_ID = 1001;

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private DatabaseReference boatRef;

    @Override
    public void onCreate() {
        super.onCreate();
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        boatRef = FirebaseDatabase.getInstance().getReference("boat/current");
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                Location location = locationResult.getLastLocation();
                if (location != null) {
                    uploadLocation(location);
                }
            }
        };
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopTrackingAndMarkDone();
            return START_NOT_STICKY;
        }
        if (FirebaseAuth.getInstance().getCurrentUser() == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        startForeground(NOTIFICATION_ID, buildNotification());
        startLocationUpdates();
        return START_STICKY;
    }

    private void startLocationUpdates() {
        boolean fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!fine && !coarse) {
            stopSelf();
            return;
        }
        LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10000L)
                .setMinUpdateIntervalMillis(5000L)
                .setMaxUpdateDelayMillis(15000L)
                .build();
        fusedLocationClient.requestLocationUpdates(request, locationCallback, getMainLooper());
    }

    private void uploadLocation(Location location) {
        BoatStateStore.BoatState state = BoatStateStore.load(this);
        Map<String, Object> payload = new HashMap<>();
        payload.put("headline", state.headline);
        payload.put("status", state.status);
        payload.put("note", state.note);
        payload.put("pauseUntil", state.pauseUntil == 0L ? null : state.pauseUntil);
        payload.put("lat", location.getLatitude());
        payload.put("lng", location.getLongitude());
        payload.put("accuracy", location.getAccuracy());
        payload.put("updatedAt", System.currentTimeMillis());
        boatRef.updateChildren(payload);
    }

    private void stopTrackingAndMarkDone() {
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        BoatStateStore.save(this, "Done for today", "done", "Location sharing is off.", 0L);
        Map<String, Object> payload = new HashMap<>();
        payload.put("headline", "Done for today");
        payload.put("status", "done");
        payload.put("note", "Location sharing is off.");
        payload.put("pauseUntil", null);
        payload.put("updatedAt", System.currentTimeMillis());
        boatRef.updateChildren(payload);
        stopForeground(true);
        stopSelf();
    }

    private Notification buildNotification() {
        createChannel();
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, openIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Ice Cream Boat location sharing")
                .setContentText("Uploading live boat location")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Location sharing", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
