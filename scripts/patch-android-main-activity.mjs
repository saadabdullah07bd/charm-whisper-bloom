import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const configText = readFileSync('capacitor.config.ts', 'utf8');
const appId = configText.match(/appId:\s*['"]([^'"]+)['"]/)?.[1] ?? 'com.medhelp.app';
const pkgPath = appId.split('.');
const javaDir = join('android', 'app', 'src', 'main', 'java', ...pkgPath);
const mainActivityPath = join(javaDir, 'MainActivity.java');
const mediaPermissionsPluginPath = join(javaDir, 'ShiforaMediaPermissionsPlugin.java');
const dailyPluginPath = join(javaDir, 'daily', 'DailyCallPlugin.kt');
const dailyActivityPath = join(javaDir, 'daily', 'DailyCallActivity.kt');
const dailyServicePath = join(javaDir, 'daily', 'DailyCallService.kt');
const dailyScreenShareServicePath = join(javaDir, 'daily', 'DailyScreenShareService.kt');
const manifestPath = join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
const appGradlePath = join('android', 'app', 'build.gradle');
const projectGradlePath = join('android', 'build.gradle');

if (!existsSync(mainActivityPath)) {
  console.log(`[cap:patch-main] Android platform not found yet (${mainActivityPath}). Skipping.`);
  process.exit(0);
}

const writeIfChanged = (p, content) => {
  mkdirSync(dirname(p), { recursive: true });
  const current = existsSync(p) ? readFileSync(p, 'utf8') : '';
  if (current.trim() !== content.trim()) {
    writeFileSync(p, content);
    console.log(`[cap:patch-main] wrote ${p}`);
  }
};

// ──────────────────────────────────────────────────────────────────────
// 1) MainActivity.java — register Capacitor plugins
// ──────────────────────────────────────────────────────────────────────
const packageLine = `package ${appId};`;

const desiredMediaPermissionsPlugin = `${packageLine}

import android.Manifest;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "ShiforaMediaPermissions",
    permissions = {
        @Permission(strings = { Manifest.permission.CAMERA }, alias = "camera"),
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
    }
)
public class ShiforaMediaPermissionsPlugin extends Plugin {
    @PluginMethod public void check(PluginCall call) { resolveCurrentState(call); }
    @PluginMethod public void request(PluginCall call) { requestAllPermissions(call, "permissionsCallback"); }
    @PermissionCallback private void permissionsCallback(PluginCall call) { resolveCurrentState(call); }
    private void resolveCurrentState(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("camera", getPermissionState("camera").toString());
        ret.put("microphone", getPermissionState("microphone").toString());
        call.resolve(ret);
    }
}
`;

const desiredMainActivity = `${packageLine}

import android.os.Bundle;
import android.content.Intent;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

import ${appId}.daily.DailyCallPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShiforaMediaPermissionsPlugin.class);
        registerPlugin(DailyCallPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN || requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            return;
        }
        PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
        if (pluginHandle == null) { Log.i("ShiforaGoogleLogin", "SocialLogin plugin handle is null"); return; }
        Plugin plugin = pluginHandle.getInstance();
        if (!(plugin instanceof SocialLoginPlugin)) { Log.i("ShiforaGoogleLogin", "SocialLogin plugin instance is invalid"); return; }
        ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
    }
}
`;

writeIfChanged(mainActivityPath, desiredMainActivity);
writeIfChanged(mediaPermissionsPluginPath, desiredMediaPermissionsPlugin);

// ──────────────────────────────────────────────────────────────────────
// 2) Daily native Capacitor plugin (Kotlin)
// ──────────────────────────────────────────────────────────────────────
const dailyPluginKt = `package ${appId}.daily

import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "DailyCall")
class DailyCallPlugin : Plugin() {

    companion object {
        @Volatile var pending: PluginCall? = null
        fun finish(result: JSObject) {
            val call = pending ?: return
            pending = null
            call.resolve(result)
        }
        fun fail(message: String) {
            val call = pending ?: return
            pending = null
            call.reject(message)
        }
    }

    @PluginMethod
    fun startCall(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrBlank()) { call.reject("url is required"); return }
        val token = call.getString("token")
        val userName = call.getString("userName") ?: "Guest"
        val isDoctor = call.getBoolean("isDoctor", false) ?: false

        call.setKeepAlive(true)
        pending = call

        val intent = Intent(context, DailyCallActivity::class.java).apply {
            putExtra("url", url)
            putExtra("token", token)
            putExtra("userName", userName)
            putExtra("isDoctor", isDoctor)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val ret = JSObject()
        ret.put("available", true)
        call.resolve(ret)
    }
}
`;
writeIfChanged(dailyPluginPath, dailyPluginKt);

// ──────────────────────────────────────────────────────────────────────
// 3) Foreground service to keep call alive in background
// ──────────────────────────────────────────────────────────────────────
const dailyServiceKt = `package ${appId}.daily

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class DailyCallService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "shifora_call",
                "Active video call",
                NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val tapIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pi = PendingIntent.getActivity(
            this, 0,
            tapIntent ?: Intent(),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val notification: Notification = NotificationCompat.Builder(this, "shifora_call")
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle("Shifora video call")
            .setContentText("Call in progress")
            .setOngoing(true)
            .setContentIntent(pi)
            .build()
        startForeground(1001, notification)
        return START_STICKY
    }
}
`;
writeIfChanged(dailyServicePath, dailyServiceKt);

// ──────────────────────────────────────────────────────────────────────
// 4) Native call Activity — programmatic UI, prejoin + in-call controls
// ──────────────────────────────────────────────────────────────────────
const dailyActivityKt = `package ${appId}.daily

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions
import androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import co.daily.CallClient
import co.daily.CallClientListener
import co.daily.model.AvailableDevices
import co.daily.model.CallState
import co.daily.model.MediaDeviceInfo
import co.daily.model.MeetingToken
import co.daily.model.Participant
import co.daily.model.ParticipantId
import co.daily.model.ParticipantLeftReason
import co.daily.settings.CameraInputSettingsUpdate
import co.daily.settings.FacingModeUpdate
import co.daily.settings.InputSettingsUpdate
import co.daily.settings.VideoMediaTrackSettingsUpdate
import co.daily.settings.VideoProcessor
import com.getcapacitor.JSObject
import co.daily.view.VideoView

private const val TAG = "DailyCallActivity"

class DailyCallActivity : AppCompatActivity(), CallClientListener {

    private var callClient: CallClient? = null
    private var url: String = ""
    private var token: String? = null
    private var userName: String = "Guest"
    private var isDoctor: Boolean = false

    private var joinedAt: Long = 0L
    private var remoteEverJoined: Boolean = false
    private var hasJoined = false
    private var hasFinished = false

    private var micEnabled = true
    private var camEnabled = true
    private var facing = FacingModeUpdate.user
    private var blurLevel = 0  // 0=off, 1=low, 2=high
    private var audioDevices: List<MediaDeviceInfo> = emptyList()
    private var activeAudioDeviceId: String? = null
    private var isScreenSharing = false

    private lateinit var root: FrameLayout
    private lateinit var remoteContainer: FrameLayout
    private lateinit var localContainer: FrameLayout
    private lateinit var statusText: TextView
    private lateinit var prejoinPanel: LinearLayout
    private lateinit var controlsPanel: LinearLayout
    private lateinit var joinButton: Button
    private lateinit var micButton: Button
    private lateinit var camButton: Button
    private lateinit var flipButton: Button
    private lateinit var blurButton: Button
    private lateinit var speakerButton: Button
    private lateinit var shareButton: Button
    private lateinit var leaveButton: Button
    private var localVideoView: VideoView? = null
    private var remoteVideoView: VideoView? = null

    private lateinit var mediaProjectionManager: MediaProjectionManager

    private val permissionLauncher = registerForActivityResult(RequestMultiplePermissions()) { result ->
        if (result.values.any { !it }) {
            statusText.text = "Camera and microphone permission required"
        } else {
            initClient()
        }
    }

    private val screenShareLauncher = registerForActivityResult(StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val data = result.data!!
            DailyScreenShareService.pendingStarter = Runnable {
                try {
                    callClient?.startScreenShare(data)
                    isScreenSharing = true
                    runOnUiThread { shareButton.text = "Stop share" }
                } catch (t: Throwable) {
                    Log.e(TAG, "startScreenShare failed", t)
                }
            }
            val svc = Intent(this, DailyScreenShareService::class.java)
            ContextCompat.startForegroundService(this, svc)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        url = intent.getStringExtra("url") ?: ""
        token = intent.getStringExtra("token")
        userName = intent.getStringExtra("userName") ?: "Guest"
        isDoctor = intent.getBooleanExtra("isDoctor", false)

        mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager

        buildUi()

        val needed = mutableListOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val missing = needed.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) initClient() else permissionLauncher.launch(missing.toTypedArray())
    }

    private fun dp(v: Int): Int = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics
    ).toInt()

    private fun buildUi() {
        root = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(MATCH, MATCH)
            setBackgroundColor(Color.BLACK)
        }
        remoteContainer = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(MATCH, MATCH)
            setBackgroundColor(Color.parseColor("#111111"))
        }
        root.addView(remoteContainer)

        localContainer = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(dp(110), dp(160), Gravity.TOP or Gravity.END).apply {
                topMargin = dp(48); rightMargin = dp(12)
            }
            setBackgroundColor(Color.DKGRAY)
        }
        root.addView(localContainer)

        statusText = TextView(this).apply {
            setTextColor(Color.WHITE); textSize = 16f
            text = "Preparing call…"
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(MATCH, WRAP, Gravity.CENTER)
        }
        root.addView(statusText)

        // Prejoin panel
        prejoinPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#cc000000"))
            setPadding(dp(20), dp(20), dp(20), dp(20))
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(MATCH, WRAP, Gravity.BOTTOM)
        }
        val preTitle = TextView(this).apply {
            text = "Ready to join?"; setTextColor(Color.WHITE); textSize = 18f; gravity = Gravity.CENTER
        }
        val preHint = TextView(this).apply {
            text = "Check your camera, mic and effects, then tap Join."
            setTextColor(Color.parseColor("#cccccc")); textSize = 13f
            gravity = Gravity.CENTER; setPadding(0, dp(4), 0, dp(12))
        }
        val preRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER
        }
        val pMic = makeBtn("Mic on") { toggleMic(); (it as Button).text = if (micEnabled) "Mic on" else "Mic off" }
        val pCam = makeBtn("Cam on") { toggleCam(); (it as Button).text = if (camEnabled) "Cam on" else "Cam off" }
        val pFlip = makeBtn("Flip") { flipCamera() }
        val pBlur = makeBtn("Blur: off") { cycleBlur(); (it as Button).text = blurLabel() }
        preRow.addView(pMic); preRow.addView(spacer())
        preRow.addView(pCam); preRow.addView(spacer())
        preRow.addView(pFlip); preRow.addView(spacer())
        preRow.addView(pBlur)
        joinButton = Button(this).apply {
            text = "Join meeting"
            setBackgroundColor(Color.parseColor("#16a34a"))
            setTextColor(Color.WHITE)
            setPadding(dp(16), dp(12), dp(16), dp(12))
            setOnClickListener { doJoin() }
        }
        val cancelBtn = Button(this).apply {
            text = "Cancel"
            setBackgroundColor(Color.parseColor("#444444"))
            setTextColor(Color.WHITE)
            setOnClickListener { finishWithResult(joined = false, errorMessage = null) }
        }
        prejoinPanel.addView(preTitle); prejoinPanel.addView(preHint); prejoinPanel.addView(preRow)
        val joinRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER
            setPadding(0, dp(16), 0, 0)
        }
        joinRow.addView(cancelBtn); joinRow.addView(spacer()); joinRow.addView(joinButton)
        prejoinPanel.addView(joinRow)
        root.addView(prejoinPanel)

        // In-call controls (hidden until joined) — scrollable to fit extra buttons
        val controlsScroll = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            setBackgroundColor(Color.parseColor("#aa000000"))
            visibility = View.GONE
            layoutParams = FrameLayout.LayoutParams(MATCH, WRAP, Gravity.BOTTOM)
        }
        controlsPanel = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), dp(12), dp(12), dp(20))
        }
        micButton = makeBtn("Mic on") { toggleMic(); micButton.text = if (micEnabled) "Mic on" else "Mic off" }
        camButton = makeBtn("Cam on") { toggleCam(); camButton.text = if (camEnabled) "Cam on" else "Cam off" }
        flipButton = makeBtn("Flip") { flipCamera() }
        blurButton = makeBtn("Blur: off") { cycleBlur(); blurButton.text = blurLabel() }
        speakerButton = makeBtn("Speaker") { cycleSpeaker() }
        shareButton = makeBtn("Share") { toggleScreenShare() }
        leaveButton = Button(this).apply {
            text = "Leave"
            setBackgroundColor(Color.parseColor("#dc2626"))
            setTextColor(Color.WHITE)
            setOnClickListener { doLeave() }
        }
        controlsPanel.addView(micButton); controlsPanel.addView(spacer())
        controlsPanel.addView(camButton); controlsPanel.addView(spacer())
        controlsPanel.addView(flipButton); controlsPanel.addView(spacer())
        controlsPanel.addView(blurButton); controlsPanel.addView(spacer())
        controlsPanel.addView(speakerButton); controlsPanel.addView(spacer())
        controlsPanel.addView(shareButton); controlsPanel.addView(spacer())
        controlsPanel.addView(leaveButton)
        controlsScroll.addView(controlsPanel)
        root.addView(controlsScroll)
        // Keep a reference so we can toggle visibility from onCallStateUpdated
        controlsPanel.tag = controlsScroll

        setContentView(root)
    }

    private fun makeBtn(label: String, onClick: (View) -> Unit): Button = Button(this).apply {
        text = label
        setBackgroundColor(Color.parseColor("#374151"))
        setTextColor(Color.WHITE)
        setOnClickListener(onClick)
    }

    private fun spacer(): View = View(this).apply {
        layoutParams = LinearLayout.LayoutParams(dp(8), 1)
    }

    private fun blurLabel(): String = when (blurLevel) {
        1 -> "Blur: low"
        2 -> "Blur: high"
        else -> "Blur: off"
    }

    private fun initClient() {
        try {
            callClient = CallClient(applicationContext, lifecycle)
            callClient?.addListener(this)
            callClient?.setUserName(userName) {}
            callClient?.setInputsEnabled(camera = true, microphone = true) {}
            statusText.text = "Tap Join to start"
        } catch (t: Throwable) {
            Log.e(TAG, "Failed to init CallClient", t)
            statusText.text = "Failed to start call client: " + t.message
        }
    }

    private fun doJoin() {
        val client = callClient ?: return
        statusText.text = "Joining…"
        joinButton.isEnabled = false
        val meetingToken = token?.takeIf { it.isNotBlank() }?.let { MeetingToken(it) }
        client.join(url, meetingToken) { result ->
            result.error?.apply {
                Log.e(TAG, "Join error: " + this.msg)
                runOnUiThread {
                    statusText.text = "Could not join: " + this.msg
                    joinButton.isEnabled = true
                }
            }
        }
        try {
            val svc = Intent(this, DailyCallService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(svc) else startService(svc)
        } catch (_: Throwable) {}
    }

    private fun doLeave() {
        if (isScreenSharing) {
            try { callClient?.stopScreenShare() } catch (_: Throwable) {}
            try { stopService(Intent(this, DailyScreenShareService::class.java)) } catch (_: Throwable) {}
            isScreenSharing = false
        }
        val client = callClient
        if (client == null) { finishWithResult(joined = hasJoined, errorMessage = null); return }
        client.leave {}
        root.postDelayed({ if (!hasFinished) finishWithResult(joined = hasJoined, errorMessage = null) }, 1500)
    }

    private fun toggleMic() {
        micEnabled = !micEnabled
        callClient?.setInputsEnabled(microphone = micEnabled) {}
    }

    private fun toggleCam() {
        camEnabled = !camEnabled
        callClient?.setInputsEnabled(camera = camEnabled) {}
        updateLocalView()
    }

    private fun flipCamera() {
        facing = if (facing == FacingModeUpdate.user) FacingModeUpdate.environment else FacingModeUpdate.user
        callClient?.updateInputs(
            InputSettingsUpdate(
                camera = VideoMediaTrackSettingsUpdate(
                    settings = CameraInputSettingsUpdate(facingMode = facing)
                )
            )
        ) {}
    }

    private fun cycleBlur() {
        blurLevel = (blurLevel + 1) % 3
        val processor: VideoProcessor = when (blurLevel) {
            1 -> VideoProcessor.BackgroundBlur(0.6)
            2 -> VideoProcessor.BackgroundBlur(1.0)
            else -> VideoProcessor.None
        }
        try {
            callClient?.updateInputs(
                InputSettingsUpdate(
                    camera = VideoMediaTrackSettingsUpdate(
                        settings = CameraInputSettingsUpdate(processor = processor)
                    )
                )
            ) {}
        } catch (t: Throwable) {
            Log.w(TAG, "Set blur failed: " + t.message)
        }
    }

    private fun cycleSpeaker() {
        if (audioDevices.isEmpty()) return
        val idx = audioDevices.indexOfFirst { it.deviceId == activeAudioDeviceId }
        val next = audioDevices[(idx + 1).coerceAtLeast(0) % audioDevices.size]
        try {
            callClient?.setAudioDevice(next.deviceId)
            activeAudioDeviceId = next.deviceId
            speakerButton.text = "Audio: " + (next.label.take(10))
        } catch (t: Throwable) {
            Log.w(TAG, "setAudioDevice failed: " + t.message)
        }
    }

    private fun toggleScreenShare() {
        if (!hasJoined) return
        if (isScreenSharing) {
            try { callClient?.stopScreenShare() } catch (_: Throwable) {}
            try { stopService(Intent(this, DailyScreenShareService::class.java)) } catch (_: Throwable) {}
            isScreenSharing = false
            shareButton.text = "Share"
        } else {
            val captureIntent = mediaProjectionManager.createScreenCaptureIntent()
            screenShareLauncher.launch(captureIntent)
        }
    }

    private fun updateLocalView() {
        val client = callClient ?: return
        val track = client.participants().local.media?.camera?.track
        if (track != null && camEnabled) {
            val v = localVideoView ?: VideoView(this).apply {
                bringVideoToFront = true
                localVideoView = this
                localContainer.addView(this)
            }
            v.track = track
            localContainer.visibility = View.VISIBLE
        } else {
            localContainer.visibility = View.GONE
        }
    }

    private fun updateRemoteView() {
        val client = callClient ?: return
        val remote = client.participants().all.values.firstOrNull { !it.info.isLocal }
        val track = remote?.media?.camera?.track
        if (track != null) {
            val v = remoteVideoView ?: VideoView(this).apply {
                remoteVideoView = this
                videoScaleMode = VideoView.VideoScaleMode.FILL
                remoteContainer.addView(this)
            }
            v.track = track
            statusText.visibility = View.GONE
        } else {
            remoteContainer.removeView(remoteVideoView)
            remoteVideoView = null
            statusText.visibility = View.VISIBLE
            statusText.text = if (hasJoined) "Waiting for the other person to join…" else statusText.text.toString()
        }
    }

    // ── CallClientListener ──
    override fun onCallStateUpdated(state: CallState) {
        runOnUiThread {
            when (state) {
                CallState.joining -> statusText.text = "Joining…"
                CallState.joined -> {
                    hasJoined = true
                    joinedAt = System.currentTimeMillis()
                    prejoinPanel.visibility = View.GONE
                    (controlsPanel.tag as? View)?.visibility = View.VISIBLE
                    statusText.text = "Waiting for the other person to join…"
                    updateLocalView()
                    updateRemoteView()
                }
                CallState.left -> finishWithResult(joined = hasJoined, errorMessage = null)
                else -> {}
            }
        }
    }

    override fun onParticipantJoined(participant: Participant) {
        if (!participant.info.isLocal) remoteEverJoined = true
        runOnUiThread { updateRemoteView() }
    }

    override fun onParticipantUpdated(participant: Participant) {
        runOnUiThread {
            if (participant.info.isLocal) updateLocalView() else updateRemoteView()
        }
    }

    override fun onParticipantLeft(participant: Participant, reason: ParticipantLeftReason) {
        runOnUiThread { updateRemoteView() }
    }

    override fun onAvailableDevicesUpdated(availableDevices: AvailableDevices) {
        audioDevices = availableDevices.audio
        if (activeAudioDeviceId == null) {
            activeAudioDeviceId = audioDevices.firstOrNull()?.deviceId
        }
        runOnUiThread {
            val label = audioDevices.firstOrNull { it.deviceId == activeAudioDeviceId }?.label
            if (::speakerButton.isInitialized && label != null) {
                speakerButton.text = "Audio: " + label.take(10)
            }
        }
    }

    override fun onError(message: String) {
        Log.e(TAG, "Daily error: " + message)
        runOnUiThread { statusText.text = "Error: " + message }
    }

    private fun finishWithResult(joined: Boolean, errorMessage: String?) {
        if (hasFinished) return
        hasFinished = true
        try { stopService(Intent(this, DailyCallService::class.java)) } catch (_: Throwable) {}
        try { stopService(Intent(this, DailyScreenShareService::class.java)) } catch (_: Throwable) {}
        try { callClient?.release() } catch (_: Throwable) {}
        callClient = null

        val durationMs = if (joinedAt > 0) System.currentTimeMillis() - joinedAt else 0L
        val res = JSObject().apply {
            put("joined", joined)
            put("durationMs", durationMs)
            put("remoteJoined", remoteEverJoined)
            if (errorMessage != null) put("error", errorMessage)
        }
        DailyCallPlugin.finish(res)
        finish()
    }

    override fun onDestroy() {
        if (!hasFinished) finishWithResult(joined = hasJoined, errorMessage = null)
        super.onDestroy()
    }

    companion object {
        private const val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
        private const val WRAP = ViewGroup.LayoutParams.WRAP_CONTENT
    }
}
`;
writeIfChanged(dailyActivityPath, dailyActivityKt);

// Screen-share foreground service (mediaProjection type)
const dailyScreenShareServiceKt = `package ${appId}.daily

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class DailyScreenShareService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        @Volatile var pendingStarter: Runnable? = null
    }

    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "shifora_screen_share",
                "Screen sharing",
                NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val tapIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pi = PendingIntent.getActivity(
            this, 0,
            tapIntent ?: Intent(),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val n: Notification = NotificationCompat.Builder(this, "shifora_screen_share")
            .setSmallIcon(android.R.drawable.ic_menu_share)
            .setContentTitle("Shifora screen share")
            .setContentText("Sharing screen")
            .setOngoing(true)
            .setContentIntent(pi)
            .build()
        startForeground(1002, n)
        pendingStarter?.run()
        pendingStarter = null
        return START_STICKY
    }
}
`;
writeIfChanged(dailyScreenShareServicePath, dailyScreenShareServiceKt);

// ──────────────────────────────────────────────────────────────────────
// 5) AndroidManifest.xml — perms, foreground services
// ──────────────────────────────────────────────────────────────────────
if (existsSync(manifestPath)) {
  let manifest = readFileSync(manifestPath, 'utf8');
  const before = manifest;

  const neededPerms = [
    'android.permission.INTERNET',
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.MODIFY_AUDIO_SETTINGS',
    'android.permission.BLUETOOTH_CONNECT',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_CAMERA',
    'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
  ];
  for (const name of neededPerms) {
    const re = new RegExp(`android:name="${name.replace(/\./g, '\\.')}"`);
    if (!re.test(manifest)) {
      manifest = manifest.replace(/<application/, `    <uses-permission android:name="${name}" />\n    <application`);
    }
  }
  const features = [
    '<uses-feature android:name="android.hardware.camera" android:required="false" />',
    '<uses-feature android:name="android.hardware.microphone" android:required="false" />',
  ];
  for (const tag of features) {
    const n = tag.match(/android:name="([^"]+)"/)?.[1] ?? '';
    const re = new RegExp(`uses-feature[^>]*android:name="${n.replace(/\./g, '\\.')}"`);
    if (!re.test(manifest)) {
      manifest = manifest.replace(/<application/, `    ${tag}\n    <application`);
    }
  }

  // DailyCallActivity declaration (inside <application>)
  if (!/DailyCallActivity/.test(manifest)) {
    const activityTag = `        <activity android:name="${appId}.daily.DailyCallActivity" android:exported="false" android:configChanges="keyboard|keyboardHidden|orientation|screenSize|uiMode|navigation" android:screenOrientation="portrait" android:theme="@style/Theme.AppCompat.NoActionBar" />\n`;
    manifest = manifest.replace(/<\/application>/, `${activityTag}    </application>`);
  }
  if (!/DailyCallService/.test(manifest)) {
    const svcTag = `        <service android:name="${appId}.daily.DailyCallService" android:exported="false" android:foregroundServiceType="camera|microphone" />\n`;
    manifest = manifest.replace(/<\/application>/, `${svcTag}    </application>`);
  }
  if (!/DailyScreenShareService/.test(manifest)) {
    const svcTag = `        <service android:name="${appId}.daily.DailyScreenShareService" android:exported="false" android:foregroundServiceType="mediaProjection" />\n`;
    manifest = manifest.replace(/<\/application>/, `${svcTag}    </application>`);
  }

  if (manifest !== before) {
    writeFileSync(manifestPath, manifest);
    console.log('[cap:patch-main] Updated AndroidManifest.xml (perms + Daily activity/service).');
  }
}

// ──────────────────────────────────────────────────────────────────────
// 6) Project-level build.gradle — Kotlin classpath + mavenCentral
// ──────────────────────────────────────────────────────────────────────
if (existsSync(projectGradlePath)) {
  let g = readFileSync(projectGradlePath, 'utf8');
  const before = g;
  if (!/kotlin-gradle-plugin/.test(g)) {
    // Inject classpath inside the first buildscript { dependencies { ... } } block
    g = g.replace(
      /(buildscript\s*\{[\s\S]*?dependencies\s*\{)/,
      `$1\n        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.22"`,
    );
  }
  if (!/mavenCentral\(\)/.test(g)) {
    g = g.replace(/(allprojects\s*\{[\s\S]*?repositories\s*\{)/, `$1\n        mavenCentral()`);
  }
  if (g !== before) {
    writeFileSync(projectGradlePath, g);
    console.log('[cap:patch-main] Patched android/build.gradle (kotlin + mavenCentral).');
  }
}

// ──────────────────────────────────────────────────────────────────────
// 7) App-level build.gradle — apply kotlin plugin + Daily SDK deps
// ──────────────────────────────────────────────────────────────────────
if (existsSync(appGradlePath)) {
  let g = readFileSync(appGradlePath, 'utf8');
  const before = g;

  if (!/apply plugin: ['"]kotlin-android['"]/.test(g)) {
    g = g.replace(
      /apply plugin: ['"]com\.android\.application['"]/,
      `apply plugin: 'com.android.application'\napply plugin: 'kotlin-android'`,
    );
  }

  // Ensure mavenCentral repo is reachable for app deps (already from project-level, but harmless)
  // Add Daily SDK + Kotlin coroutines + appcompat dependencies
  const depsToAdd = [
    `    implementation "co.daily:client:0.37.0"`,
    `    implementation "co.daily:client-videoprocessor-plugin:0.1.1"`,
    `    implementation "org.jetbrains.kotlin:kotlin-stdlib:1.9.22"`,
    `    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1"`,
    `    implementation "androidx.appcompat:appcompat:1.7.0"`,
    `    implementation "androidx.core:core-ktx:1.13.1"`,
  ];
  for (const line of depsToAdd) {
    const marker = line.match(/"([^"]+):[^"]+"/)?.[1] ?? '';
    if (marker && !g.includes(marker)) {
      // append into the last dependencies { } block
      g = g.replace(/dependencies\s*\{([\s\S]*?)\n\}/, (m, inner) => `dependencies {${inner}\n${line}\n}`);
    }
  }

  // Bump minSdkVersion to >= 23 (Daily requires 21, demo uses 23)
  g = g.replace(/minSdkVersion\s+(\d+)/, (m, v) => (parseInt(v, 10) < 23 ? 'minSdkVersion 23' : m));

  // ── Release signing config (reads from android/keystore.properties) ──
  if (!/keystoreProperties/.test(g)) {
    g = g.replace(
      /android\s*\{/,
      `def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {`,
    );
  }

  if (!/signingConfigs\s*\{/.test(g)) {
    g = g.replace(
      /(\n\s*buildTypes\s*\{)/,
      `\n    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }

    buildTypes {`,
    );
  }

  if (!/signingConfig signingConfigs\.release/.test(g)) {
    g = g.replace(
      /(release\s*\{[\s\S]*?)(minifyEnabled\s+\w+)/,
      `$1signingConfig signingConfigs.release\n            $2`,
    );
  }

  if (g !== before) {
    writeFileSync(appGradlePath, g);
    console.log('[cap:patch-main] Patched android/app/build.gradle (kotlin + Daily deps + signing).');
  }
}


console.log('[cap:patch-main] Done.');
