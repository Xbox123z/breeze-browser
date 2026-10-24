package com.breeze.browser

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.drawable.BitmapDrawable
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.view.KeyEvent
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder

/**
 * Breeze Android —— 极简单 Activity：
 * 顶部地址栏 + WebView + 底部（书签/壁纸/菜单）。
 * 数据用 SharedPreferences 持久化（书签、壁纸选择）。
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var omni: EditText
    private lateinit var progress: ProgressBar
    private lateinit var root: LinearLayout

    private val prefs by lazy { getSharedPreferences("breeze", Context.MODE_PRIVATE) }

    companion object {
        val WALLPAPERS = linkedMapOf(
            "aurora" to 0xFF203A43,
            "dusk"   to 0xFF2F0743,
            "forest" to 0xFF134E5E,
            "mono"   to 0xFF141E30,
            "rose"   to 0xFF642B73,
            "ocean"  to 0xFF1A2980,
            "paper"  to 0xFFECE9E6
        )
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFF0F1115.toInt())
        }
        setContentView(root)

        // ---------- 顶栏 ----------
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(12, 24, 12, 8)
        }
        omni = EditText(this).apply {
            hint = "搜索或输入网址"
            setSingleLine()
            imeOptions = EditorInfo.IME_ACTION_GO
            setSelectAllOnFocus(true)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        val goBtn = ImageButton(this).apply {
            setImageResource(android.R.drawable.ic_menu_compass)
            setBackgroundColor(0)
            setOnClickListener { loadFromOmni() }
        }
        bar.addView(omni); bar.addView(goBtn)
        root.addView(bar)

        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 4)
        }
        root.addView(progress)

        // ---------- WebView ----------
        webView = WebView(this).apply {
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.builtInZoomControls = false
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                    // 外部协议交给系统
                    val u = r.url.toString()
                    if (!u.startsWith("http://") && !u.startsWith("https://")) {
                        runCatching { startActivity(Intent(Intent.ACTION_VIEW, r.url)) }
                        return true
                    }
                    return false
                }
                override fun onPageFinished(v: WebView, url: String) {
                    omni.setText(if (url == "about:blank") "" else url)
                    this@MainActivity.progress.progress = 0
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onProgressChanged(v: WebView, p: Int) {
                    this@MainActivity.progress.progress = p
                }
            }
        }
        root.addView(webView)

        // ---------- 底栏 ----------
        val bottom = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(8, 4, 8, 16)
        }
        fun btn(icon: Int, desc: String, onClick: () -> Unit) = ImageButton(this).apply {
            setImageResource(icon); contentDescription = desc
            setBackgroundColor(0)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            setOnClickListener { onClick() }
        }
        bottom.addView(btn(android.R.drawable.ic_menu_revert, "后退") { if (webView.canGoBack()) webView.goBack() })
        bottom.addView(btn(android.R.drawable.ic_menu_rotate, "刷新") { webView.reload() })
        bottom.addView(btn(android.R.drawable.ic_menu_add, "新标签") { showNewTab() })
        bottom.addView(btn(android.R.drawable.btn_star_big_off, "书签") { toggleBookmark() })
        bottom.addView(btn(android.R.drawable.ic_menu_preferences, "菜单") { showMenu() })
        root.addView(bottom)

        applyWallpaper()

        // 处理“用浏览器打开” intent
        val startUrl = intent?.dataString ?: prefs.getString("home", null) ?: "about:blank"
        if (startUrl == "about:blank") showNewTab() else webView.loadUrl(startUrl)

        omni.setOnEditorActionListener { _, actionId, event ->
            if (actionId == EditorInfo.IME_ACTION_GO ||
                (event?.keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN)) {
                loadFromOmni(); true
            } else false
        }
    }

    private fun loadFromOmni() {
        var v = omni.text.toString().trim()
        if (v.isEmpty()) return
        if (!Regex("^[a-z]+://", RegexOption.IGNORE_CASE).containsMatchIn(v)) {
            v = if (Regex("^[\\w-]+(\\.[\\w-]+)+(:\\d+)?(/\\S*)?$").matches(v)) "https://$v"
                else "https://www.google.com/search?q=" + URLEncoder.encode(v, "UTF-8")
        }
        webView.loadUrl(v)
        hideKeyboard()
        omni.clearFocus()
    }

    private fun showNewTab() {
        webView.loadUrl("about:blank")
        omni.setText("")
        omni.requestFocus()
        showKeyboard()
    }

    /* ---------------- 书签 ---------------- */
    private fun bookmarks(): JSONArray =
        runCatching { JSONArray(prefs.getString("bookmarks", "[]")) }.getOrDefault(JSONArray())

    private fun toggleBookmark() {
        val url = webView.url ?: return toast("当前页不可收藏")
        if (!url.startsWith("http")) return toast("当前页不可收藏")
        val arr = bookmarks()
        var found = -1
        for (i in 0 until arr.length()) {
            if (arr.getJSONObject(i).optString("url") == url) { found = i; break }
        }
        if (found >= 0) {
            arr.remove(found); toast("已取消收藏")
        } else {
            arr.put(JSONObject().put("title", webView.title ?: url).put("url", url))
            toast("已收藏")
        }
        prefs.edit().putString("bookmarks", arr.toString()).apply()
    }

    private fun showBookmarks() {
        val arr = bookmarks()
        if (arr.length() == 0) return toast("还没有书签")
        val items = Array(arr.length()) { arr.getJSONObject(it).optString("title") }
        AlertDialog.Builder(this)
            .setTitle("书签")
            .setItems(items) { _, i ->
                webView.loadUrl(arr.getJSONObject(i).getString("url"))
            }
            .setNegativeButton("关闭", null)
            .show()
    }

    /* ---------------- 菜单/壁纸/导入 ---------------- */
    private fun showMenu() {
        val items = arrayOf("书签管理", "切换壁纸", "从文件导入书签 (Chrome HTML)", "清除数据")
        AlertDialog.Builder(this)
            .setItems(items) { _, i ->
                when (i) {
                    0 -> showBookmarks()
                    1 -> showWallpaperPicker()
                    2 -> importBookmarksHtml()
                    3 -> clearData()
                }
            }.show()
    }

    private fun showWallpaperPicker() {
        val names = WALLPAPERS.keys.toTypedArray()
        val cur = prefs.getString("wallpaper", "aurora")
        val checked = names.indexOf(cur).coerceAtLeast(0)
        AlertDialog.Builder(this)
            .setTitle("壁纸风格")
            .setSingleChoiceItems(names, checked) { d, i ->
                prefs.edit().putString("wallpaper", names[i]).apply()
                applyWallpaper(); d.dismiss()
            }.show()
    }

    private fun applyWallpaper() {
        val name = prefs.getString("wallpaper", "aurora")
        val custom = prefs.getString("customWallpaper", null)
        if (name == "custom" && custom != null) {
            runCatching {
                val bytes = Base64.decode(custom, Base64.DEFAULT)
                val bmp: Bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                root.background = BitmapDrawable(resources, bmp)
                return
            }
        }
        val color = (WALLPAPERS[name] ?: WALLPAPERS["aurora"]!!).toInt()
        root.setBackgroundColor(color)
    }

    /**
     * 导入 Chrome 导出的书签 HTML（Chrome 桌面：书签管理器 -> 导出）。
     * 解析 <A HREF="...">title</A>。
     */
    private fun importBookmarksHtml() {
        // 简化：从共享存储读取用户手动放置的文件
        toast("请将 Chrome 导出的 bookmarks.html 放到 Downloads，然后重试")
        val file = java.io.File(
            android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS),
            "bookmarks.html"
        )
        if (!file.exists()) return
        val html = file.readText()
        val regex = Regex("""<A\s+HREF="([^"]+)"[^>]*>([^<]*)</A>""", RegexOption.IGNORE_CASE)
        val arr = bookmarks()
        var added = 0
        for (m in regex.findAll(html)) {
            val url = m.groupValues[1]
            val title = m.groupValues[2].ifBlank { url }
            var dup = false
            for (i in 0 until arr.length()) if (arr.getJSONObject(i).optString("url") == url) { dup = true; break }
            if (!dup) { arr.put(JSONObject().put("title", title).put("url", url)); added++ }
        }
        prefs.edit().putString("bookmarks", arr.toString()).apply()
        toast("导入 $added 条书签")
    }

    private fun clearData() {
        webView.clearCache(true)
        webView.clearHistory()
        prefs.edit().clear().apply()
        toast("已清除")
    }

    /* ---------------- 辅助 ---------------- */
    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    private fun hideKeyboard() =
        (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager)
            .hideSoftInputFromWindow(omni.windowToken, 0)
    private fun showKeyboard() =
        (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager)
            .showSoftInput(omni, InputMethodManager.SHOW_IMPLICIT)

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
