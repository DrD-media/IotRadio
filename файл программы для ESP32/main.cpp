#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <driver/i2s.h>
#include <Preferences.h>
#include <WebServer.h>
#include <DNSServer.h>

// ========== МЕНЕДЖЕР КОНФИГУРАЦИИ ==========
Preferences preferences;
WebServer server(80);
DNSServer dnsServer;

// Структура для хранения настроек
struct Config {
  char ssid[64];
  char password[64];
  char serverIP[16];
  int port;
  bool configured;
} config;

// ========== ПРЕСЕТЫ (заполни своими) ==========
const int PRESET_COUNT = 5;
struct Preset {
  char name[32];
  char ssid[64];
  char password[64];
  char serverIP[16];
  int port;
};

// TODO: ЗАПОЛНИ СВОИМИ ПРЕСЕТАМИ!
Preset presets[PRESET_COUNT] = {
  {"Домашний WiFi.0.105", "TP-Link_E37C", "03783658", "192.168.0.105", 5000},
  {"Телефон WiFi.1.100", "Xiaomi 14T Pro", "98734554321", "192.168.1.100", 5000},
  {"Рабочий WiFi.177.195", "Xiaomi 14T Pro", "98734554321", "192.168.177.195", 5000},
  {"Телефон WiFi.134.195", "Xiaomi 14T Pro", "98734554321", "192.168.134.195", 5000},
  {"Тестовый нерабоч", "Test_Network", "test123", "192.168.0.200", 5000}
};

// ========== СТАРЫЕ НАСТРОЙКИ (закомментированы) ==========
// WiFi
// const char* ssid = "Xiaomi 14T Pro";
// const char* password = "98734554321";
// const char* ssid = "TP-Link_E37C";
// const char* password = "03783658";

// Сервер (IP твоего компьютера)
//const char* server = "192.168.171.195";  // Замени на свой IP!
//const char* server = "192.168.92.195";  // Замени на свой IP!
//const char* server = "192.168.177.195";  // Замени на свой IP!

// const char* server = "192.168.0.105";  // Замени на свой IP!
//const int port = 5000;

// ========== ТЕКУЩИЕ НАСТРОЙКИ (из Preferences) ==========
char current_ssid[64];
char current_password[64];
char current_serverIP[16];
int current_port;

// ========== I2S пины для UDA1334A ==========
#define I2S_BCK_PIN  26
#define I2S_WS_PIN   25
#define I2S_DATA_PIN 22

#ifndef LED_BUILTIN
  #define LED_BUILTIN 2
#endif

// Флаг режима конфигурации
bool configMode = false;
unsigned long configStartTime = 0;

// ========== ВЕБ-СТРАНИЦА ==========
const char* index_html = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <meta name='viewport' content='width=device-width, initial-scale=1'>
    <title>ESP32 Radio Config</title>
    <style>
        body { font-family: Arial; margin: 20px; background: #f0f0f0; }
        .container { max-width: 500px; margin: auto; background: white; padding: 20px; border-radius: 10px; }
        h1 { color: #2c3e50; text-align: center; }
        .preset { background: #3498db; color: white; padding: 10px; margin: 5px; border: none; border-radius: 5px; cursor: pointer; width: 100%; }
        .preset:hover { background: #2980b9; }
        input { width: 100%; padding: 8px; margin: 5px 0 15px 0; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #2ecc71; color: white; padding: 10px; border: none; border-radius: 5px; cursor: pointer; width: 100%; }
        button:hover { background: #27ae60; }
        .manual { margin-top: 20px; padding-top: 20px; border-top: 2px solid #ddd; }
        h3 { color: #e74c3c; }
        .status { background: #e8f4f8; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class='container'>
        <h1>ESP32 Radio</h1>
        <div class='status'>
            <strong>Режим:</strong> Настройка WiFi и сервера
        </div>
        
        <h2>Быстрые пресеты:</h2>
)rawliteral";

const char* index_html_mid = R"rawliteral(
        <h2 class='manual'>Ручной ввод:</h2>
        <form action='/save' method='GET'>
            <label>WiFi SSID:</label><br>
            <input type='text' name='ssid' placeholder='Имя WiFi'><br>
            <label>WiFi Password:</label><br>
            <input type='password' name='pass' placeholder='Пароль WiFi'><br>
            <label>Server IP:</label><br>
            <input type='text' name='ip' placeholder='192.168.1.100'><br>
            <label>Port:</label><br>
            <input type='text' name='port' value='5000'><br>
            <button type='submit'>Сохранить и перезагрузить</button>
        </form>
    </div>
    <script>
        function setPreset(ssid, pass, ip, port) {
            document.querySelector('input[name=\"ssid\"]').value = ssid;
            document.querySelector('input[name=\"pass\"]').value = pass;
            document.querySelector('input[name=\"ip\"]').value = ip;
            document.querySelector('input[name=\"port\"]').value = port;
        }
    </script>
</body>
</html>
)rawliteral";

// Функция генерации HTML с пресетами
String generateHTML() {
  String html = String(index_html);
  
  // Добавляем кнопки пресетов
  for (int i = 0; i < PRESET_COUNT; i++) {
    html += "<button class='preset' onclick=\"setPreset('";
    html += String(presets[i].ssid) + "', '";
    html += String(presets[i].password) + "', '";
    html += String(presets[i].serverIP) + "', '";
    html += String(presets[i].port) + "')\">";
    html += String(presets[i].name) + " - " + String(presets[i].ssid) + " @ " + String(presets[i].serverIP) + ":" + String(presets[i].port);
    html += "</button>";
  }
  
  html += String(index_html_mid);
  return html;
}

// ========== СОХРАНЕНИЕ НАСТРОЕК ==========
void saveConfig(String ssid, String password, String serverIP, int port) {
  preferences.begin("radio", false);
  preferences.putString("ssid", ssid);
  preferences.putString("password", password);
  preferences.putString("serverIP", serverIP);
  preferences.putInt("port", port);
  preferences.putBool("configured", true);
  preferences.end();
  
  Serial.println("Настройки сохранены!");
}

// ========== ЗАГРУЗКА НАСТРОЕК ==========
bool loadConfig() {
  preferences.begin("radio", true);
  bool configured = preferences.getBool("configured", false);
  
  if (configured) {
    String ssid = preferences.getString("ssid", "");
    String password = preferences.getString("password", "");
    String serverIP = preferences.getString("serverIP", "");
    int port = preferences.getInt("port", 5000);
    
    ssid.toCharArray(current_ssid, 64);
    password.toCharArray(current_password, 64);
    serverIP.toCharArray(current_serverIP, 16);
    current_port = port;
    
    Serial.println("Загружены настройки:");
    Serial.printf("  SSID: %s\n", current_ssid);
    Serial.printf("  Server: %s:%d\n", current_serverIP, current_port);
  }
  
  preferences.end();
  return configured;
}

// ========== РЕЖИМ ТОЧКИ ДОСТУПА ==========
void startConfigMode() {
  configMode = true;
  Serial.println("\n=== РЕЖИМ НАСТРОЙКИ ===");
  
  // Запускаем AP
  WiFi.mode(WIFI_AP);
  WiFi.softAP("ESP32_Radio_Config", NULL, 1, 0, 4);
  
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP адрес: ");
  Serial.println(IP);
  
  // Настраиваем DNS (перенаправляем все запросы на наш сервер)
  dnsServer.start(53, "*", IP);
  
  // Настраиваем веб-сервер
  server.on("/", []() {
    server.send(200, "text/html; charset=utf-8", generateHTML());
  });
  
  server.on("/save", []() {
    String ssid = server.arg("ssid");
    String password = server.arg("pass");
    String serverIP = server.arg("ip");
    int port = server.arg("port").toInt();
    
    if (ssid.length() > 0 && serverIP.length() > 0 && port > 0) {
      saveConfig(ssid, password, serverIP, port);
      server.send(200, "text/html; charset=utf-8", "<html><body><h1>Настройки сохранены!</h1><p>ESP32 перезагружается...</p></body></html>");
      delay(1000);
      ESP.restart();
    } else {
      server.send(400, "text/html; charset=utf-8", "<html><body><h1>Ошибка!</h1><p>Заполните все поля!</p></body></html>");
    }
  });

  server.onNotFound([]() {
    server.sendHeader("Location", "/", true);
    server.send(302, "text/plain", "");
  });
  
  server.begin();
  Serial.println("Веб-сервер запущен");
  Serial.println("Подключись к WiFi 'ESP32_Radio_Config' и открой http://192.168.4.1");
  
  configStartTime = millis();
}

// ========== ПОДКЛЮЧЕНИЕ К WI-FI ==========
bool connectWiFi() {
  Serial.print("Подключение к WiFi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(current_ssid, current_password);
  
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
    return true;
  } else {
    Serial.println("\nОшибка подключения к WiFi");
    return false;
  }
}

// ========== НАСТРОЙКА I2S (ТВОЯ ОРИГИНАЛЬНАЯ) ==========
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

  i2s_pin_config_t pin_config = {
    .mck_io_num = I2S_PIN_NO_CHANGE,
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

// ========== ПОЛНЫЙ СБРОС I2S ДЛЯ ПЕРЕКЛЮЧЕНИЯ ПОТОКОВ ==========
void resetI2S() {
  Serial.println("Сброс I2S для нового потока...");
  
  // Останавливаем и удаляем драйвер I2S
  i2s_driver_uninstall(I2S_NUM_0);
  delay(50);
  
  // Заново инициализируем I2S (как в setup)
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

  i2s_pin_config_t pin_config = {
    .mck_io_num = I2S_PIN_NO_CHANGE,
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
  Serial.println("I2S успешно перезапущен");
}

// ========== ВОСПРОИЗВЕДЕНИЕ ПОТОКА (ТВОЯ ОРИГИНАЛЬНАЯ) ==========
void playStream() {
  HTTPClient http;
  String url = "http://" + String(current_serverIP) + ":" + String(current_port) + "/api/radio/stream";
  
  http.setConnectTimeout(5000);
  http.setTimeout(10000);
  
  http.begin(url);
  Serial.println("Подключение к потоку: " + url);
  
  int httpCode = http.GET();
  
  if (httpCode == HTTP_CODE_OK) {
    WiFiClient* stream = http.getStreamPtr();
    
    // ⭐ ПОЛНЫЙ СБРОС I2S ПЕРЕД НОВЫМ ПОТОКОМ
    resetI2S();  // вместо i2s_zero_dma_buffer + delay
    
    Serial.println("Подключено к потоку! Воспроизведение...");
    
    uint8_t buffer[2048];
    size_t bytes_written;
    unsigned long lastDataTime = millis();
    
    while (http.connected()) {
        size_t available = stream->available();
        
        if (available > 0) {
            size_t toRead = (available < sizeof(buffer)) ? available : sizeof(buffer);
            int len = stream->readBytes(buffer, toRead);
            
            if (len > 0) {
                bool foundMarker = false;
                if (len >= 4) {
                    for (int i = 0; i <= len - 4; i++) {
                        if (buffer[i] == 0xDE && buffer[i+1] == 0xAD && 
                            buffer[i+2] == 0xBE && buffer[i+3] == 0xEF) {
                            foundMarker = true;
                            Serial.println("🏁 Найден маркер конца трека");
                            break;
                        }
                    }
                }
                
                if (foundMarker) {
                    break;
                }
                
                i2s_write(I2S_NUM_0, buffer, len, &bytes_written, portMAX_DELAY);
                digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
                lastDataTime = millis();
            }
        } else {
            if (millis() - lastDataTime > 3000) {
                Serial.println("⏸️ Пауза в потоке, переподключение...");
                break;
            }
            delay(1);
        }
    }
    
    Serial.println("Поток прерван");
    
  } else {
    Serial.printf("Ошибка подключения к потоку: %d\n", httpCode);
    Serial.println("Проверь:");
    Serial.println("1. Запущен ли бэкенд");
    Serial.println("2. Правильный ли IP сервера");
    Serial.println("3. Нет ли блокировки фаерволом");
  }
  
  http.end();
  delay(500);
}

// ========== SETUP (МОДИФИЦИРОВАН) ==========
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\nESP32 Radio с UDA1334A");
  Serial.println("=========================");

  pinMode(LED_BUILTIN, OUTPUT);
  
  // Загружаем сохранённые настройки
  bool hasConfig = loadConfig();
  
  if (!hasConfig) {
    Serial.println("Настройки не найдены! Запуск режима конфигурации...");
    startConfigMode();
    return;
  }
  
  // Пытаемся подключиться к WiFi
  if (!connectWiFi()) {
    Serial.println("Не удалось подключиться к WiFi! Запуск режима конфигурации...");
    startConfigMode();
    return;
  }
  
  // Успешное подключение - запускаем радио
  setupI2S();
}

// ========== LOOP (МОДИФИЦИРОВАН) ==========
void loop() {
  if (configMode) {
    // Режим настройки: обслуживаем DNS и веб-сервер
    dnsServer.processNextRequest();
    server.handleClient();
    
    // Автовыключение режима AP через 5 минут бездействия
    if (millis() - configStartTime > 300000) {
      Serial.println("Таймаут режима конфигурации, перезагрузка...");
      ESP.restart();
    }
    return;
  }
  
  // Нормальный режим работы радио
  if (WiFi.status() == WL_CONNECTED) {
    playStream();
  } else {
    Serial.println("WiFi отключен, переподключение...");
    if (!connectWiFi()) {
      Serial.println("Не удалось переподключиться, перезагрузка...");
      ESP.restart();
    }
  }
  
  delay(1000);
}

// --- ИСПРАВЛЕНИЕ 6: УДАЛЁН БЛОК app_main() ---
// Arduino framework уже определяет app_main() внутри себя.
// Повторное определение вызывает ошибку линковки:
//   "multiple definition of `app_main'"