package com.hermes.controller

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.JavascriptInterface
import org.json.JSONObject

class HermesNativeBridge(
    private val context: Context,
    private val onServerChange: (String) -> Unit
) {

    private val prefs = context.getSharedPreferences("hermes_prefs", Context.MODE_PRIVATE)

    @JavascriptInterface
    fun getServerUrl(): String {
        return prefs.getString("server_url", "http://10.0.2.2:8080") ?: "http://10.0.2.2:8080"
    }

    @JavascriptInterface
    fun setServerUrl(url: String) {
        prefs.edit().putString("server_url", url).apply()
        onServerChange(url)
    }

    @JavascriptInterface
    fun getSessionToken(): String {
        return prefs.getString("session_token", "") ?: ""
    }

    @JavascriptInterface
    fun setSessionToken(token: String) {
        prefs.edit().putString("session_token", token).apply()
    }

    @JavascriptInterface
    fun hapticFeedback(type: String) {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val effect = when (type) {
                    "heavy" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK)
                    "double" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK)
                    else -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
                }
                vibrator.vibrate(effect)
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(20)
            }
        } catch (_: Exception) {}
    }

    @JavascriptInterface
    fun getDeviceInfo(): String {
        val info = JSONObject()
        info.put("manufacturer", Build.MANUFACTURER)
        info.put("model", Build.MODEL)
        info.put("sdk", Build.VERSION.SDK_INT)
        info.put("isAndroid", true)
        return info.toString()
    }
}
