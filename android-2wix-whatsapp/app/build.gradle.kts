plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
  id("com.google.gms.google-services")
}

// Реальный FCM требует файл из Firebase Console. Placeholder в репозитории не храним.
val googleServicesJson = file("google-services.json")
if (!googleServicesJson.exists()) {
  throw GradleException(
    """
    Отсутствует Firebase Android-конфиг (FCM не заработает без него).

    1) Firebase Console → Project settings → Your apps → добавьте Android-приложение
       с package name: ru.twowix.whatsapp_shell
    2) Скачайте google-services.json и положите сюда:
       ${googleServicesJson.absolutePath}

    Файл в .gitignore — не коммитьте секреты в публичный репозиторий.
    """.trimIndent()
  )
}

android {
  namespace = "ru.twowix.whatsapp_shell"
  compileSdk = 35

  defaultConfig {
    applicationId = "ru.twowix.whatsapp_shell"
    minSdk = 26
    targetSdk = 35
    versionCode = 1
    versionName = "0.1.0"

    // Базовый URL 2wix
    buildConfigField("String", "START_URL", "\"https://2wix.ru/whatsapp\"")
    // Backend base URL (если нужен отдельный API-хост — поменять в Settings или через productFlavor)
    buildConfigField("String", "API_BASE_URL_DEFAULT", "\"https://2wix.ru\"")
  }

  buildFeatures {
    compose = true
    buildConfig = true
  }

  composeOptions {
    kotlinCompilerExtensionVersion = "1.5.14"
  }

  packaging {
    resources.excludes += setOf(
      "META-INF/AL2.0",
      "META-INF/LGPL2.1"
    )
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions {
    jvmTarget = "17"
  }
}

dependencies {
  val composeBom = platform("androidx.compose:compose-bom:2024.10.00")
  implementation(composeBom)
  androidTestImplementation(composeBom)

  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.activity:activity-compose:1.9.2")
  implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
  implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.6")
  implementation("androidx.compose.ui:ui")
  implementation("androidx.compose.ui:ui-tooling-preview")
  implementation("androidx.compose.material3:material3:1.3.0")
  implementation("androidx.compose.material:material-icons-extended")
  debugImplementation("androidx.compose.ui:ui-tooling")

  implementation("androidx.navigation:navigation-compose:2.8.2")

  // WebView helpers
  implementation("androidx.webkit:webkit:1.11.0")

  // Preferences (Settings)
  implementation("androidx.datastore:datastore-preferences:1.1.1")

  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

  // Networking (device registration)
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
  implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

  // Firebase Cloud Messaging
  implementation(platform("com.google.firebase:firebase-bom:33.5.1"))
  implementation("com.google.firebase:firebase-messaging")
}

