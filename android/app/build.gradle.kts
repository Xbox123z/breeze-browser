plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.breeze.browser"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.breeze.browser"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
    }
    // 发布签名：从环境变量读取，CI 里用 GitHub Secrets 注入。
    // 未配置时 release 构建会自动退化成 debug 签名（本地构建不会失败）。
    signingConfigs {
        create("release") {
            val ksPath = System.getenv("BREEZE_KEYSTORE")
            if (!ksPath.isNullOrBlank() && file(ksPath).exists()) {
                storeFile = file(ksPath)
                storePassword = System.getenv("BREEZE_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("BREEZE_KEY_ALIAS")
                keyPassword = System.getenv("BREEZE_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // 只有 keystore 可用时才应用正式签名
            val ksPath = System.getenv("BREEZE_KEYSTORE")
            if (!ksPath.isNullOrBlank() && file(ksPath).exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
    buildFeatures { viewBinding = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.webkit:webkit:1.10.0")
}
