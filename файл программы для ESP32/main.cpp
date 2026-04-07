#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <driver/i2s.h>
//45
// ========== НАСТРОЙКИ ==========
// WiFi
// const char* ssid = "Xiaomi 14T Pro";
// const char* password = "98734554321";

const char* ssid = "TP-Link_E37C";
const char* password = "03783658";

// Сервер (IP твоего компьютера)
//const char* server = "192.168.171.195";  // Замени на свой IP!
// const char* server = "192.168.92.195";  // Замени на свой IP!

const char* server = "192.168.0.105";  // Замени на свой IP!
const int port = 5000;

// I2S пины для UDA1334A
#define I2S_BCK_PIN  26  // BCK - Bit Clock
#define I2S_WS_PIN   25  // WS - Word Select (LRC)
#define I2S_DATA_PIN 22  // DATA - Data

// --- ИСПРАВЛЕНИЕ 1: Определяем LED_BUILTIN, если не задан ---
#ifndef LED_BUILTIN
  #define LED_BUILTIN 2  // На большинстве ESP32 DevKit — GPIO 2
#endif

// ========== НАСТРОЙКА I2S ==========
void setupI2S() {
  Serial.println("Настройка I2S для UDA1334A...");

  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = 44100,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 1024,
    .use_apll = false,
    .tx_desc_auto_clear = true,
    .fixed_mclk = 0
  };

  // --- ИСПРАВЛЕНИЕ 2: Добавлено поле .mck_io_num ---
  i2s_pin_config_t pin_config = {
    .mck_io_num = I2S_PIN_NO_CHANGE,   // ← ДОБАВЛЕНО (MCLK не используется)
    .bck_io_num = I2S_BCK_PIN,
    .ws_io_num = I2S_WS_PIN,
    .data_out_num = I2S_DATA_PIN,
    .data_in_num = I2S_PIN_NO_CHANGE
  };

  esp_err_t err = i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("Ошибка установки I2S: %d\n", err);
    return;
  }

  err = i2s_set_pin(I2S_NUM_0, &pin_config);
  if (err != ESP_OK) {
    Serial.printf("Ошибка настройки пинов: %d\n", err);
    return;
  }

  i2s_zero_dma_buffer(I2S_NUM_0);

  Serial.println("I2S настроен для UDA1334A");
}

// ========== ПОДКЛЮЧЕНИЕ К WI-FI ==========
void connectWiFi() {
  Serial.print("Подключение к WiFi");
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi подключен!");
    Serial.print("IP адрес: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nОшибка подключения к WiFi");
  }
}

// ========== ВОСПРОИЗВЕДЕНИЕ ПОТОКА ==========
void playStream() {
  HTTPClient http;

  String url = "http://" + String(server) + ":" + String(port) + "/api/radio/stream";

  // --- ИСПРАВЛЕНИЕ 3: Устанавливаем таймауты ---
  http.setConnectTimeout(5000);   // Таймаут подключения 5 сек
  http.setTimeout(10000);         // Таймаут чтения 10 сек

  http.begin(url);

  Serial.println("Подключение к потоку: " + url);

  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    WiFiClient* stream = http.getStreamPtr();

    Serial.println("Подключено к потоку! Воспроизведение...");

    uint8_t buffer[2048];
    size_t bytes_written;

    while (http.connected()) {
      size_t available = stream->available();

      if (available > 0) {
        // --- ИСПРАВЛЕНИЕ 4: Явное приведение типа в min() ---
        size_t toRead = (available < sizeof(buffer)) ? available : sizeof(buffer);
        int len = stream->readBytes(buffer, toRead);

        if (len > 0) {
          i2s_write(I2S_NUM_0, buffer, len, &bytes_written, portMAX_DELAY);
          digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
        }
      } else {
        // --- ИСПРАВЛЕНИЕ 5: delay только когда нет данных ---
        delay(1);
      }
    }

    Serial.println("Поток прерван");

  } else {
    Serial.printf("Ошибка подключения к потоку: %d\n", httpCode);
    Serial.println("Проверь:");
    Serial.println("1. Запущен ли бэкенд (python app.py)");
    Serial.println("2. Правильный ли IP сервера");
    Serial.println("3. Нет ли блокировки фаерволом");
  }

  http.end();
}

// ========== SETUP ==========
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\nESP32 Radio с UDA1334A");
  Serial.println("=========================");

  pinMode(LED_BUILTIN, OUTPUT);

  connectWiFi();
  setupI2S();
}

// ========== LOOP ==========
void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    playStream();
  } else {
    Serial.println("WiFi отключен, переподключение...");
    connectWiFi();
  }

  delay(5000);
}

// --- ИСПРАВЛЕНИЕ 6: УДАЛЁН БЛОК app_main() ---
// Arduino framework уже определяет app_main() внутри себя.
// Повторное определение вызывает ошибку линковки:
//   "multiple definition of `app_main'"