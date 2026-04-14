/*
 * ═══════════════════════════════════════════════════════════════
 *  🚑 UPGRADED SMART VACCINE DELIVERY SYSTEM
 *  ESP32 Firmware — Multi-Sensor Monitoring + Cloud Analytics
 * ═══════════════════════════════════════════════════════════════
 *
 *  Sensors:
 *    - DHT22        → Temperature + Humidity  (GPIO 4)
 *    - MPU6050 sim  → Acceleration X/Y        (GPIO 35, 32 — pots)
 *    - MQ-135 sim   → Gas / Odor level        (GPIO 34 — pot)
 *    - Tamper SW    → Box-open detection       (GPIO 15)
 *
 *  Actuators:
 *    - Buzzer       → Audible alarm            (GPIO 13)
 *    - Red LED      → Visual alert             (GPIO 2)
 *
 *  Cloud: ThingSpeak (HTTP GET)
 *
 *  Status Codes:
 *    0 = Cold-chain failure (temp out of range)
 *    1 = Normal / OK
 *    2 = Tamper (box opened)
 *    3 = Shock / Drop detected
 *    4 = Unsafe driving (overspeed)
 *    5 = Gas leakage / spoilage
 *    6 = High humidity / condensation
 *    9 = CRITICAL (damage score ≥ 5)
 * ═══════════════════════════════════════════════════════════════
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include "DHT.h"
#include <LiquidCrystal_I2C.h>

// ─── For real hardware, uncomment these: ───
// #include <Wire.h>
// #include <MPU6050.h>
// MPU6050 mpu;

// ═══════════════════ PIN DEFINITIONS ═══════════════════
#define DHT_PIN 4
#define DHT_TYPE DHT22
#define GAS_PIN 34     // MQ-135 analog (pot in Wokwi)
#define ACCEL_X_PIN 35 // MPU6050 accel-X sim (pot)
#define ACCEL_Y_PIN 32 // MPU6050 accel-Y sim (pot)
#define TAMPER_PIN 15  // Push-button (tamper switch)
#define BUZZER_PIN 13
#define LED_PIN 2

// ═══════════════════ THRESHOLDS ═══════════════════
#define TEMP_MIN 2.0       // °C — vaccine safe range low
#define TEMP_MAX 8.0       // °C — vaccine safe range high
#define ACCEL_SHOCK 20000  // raw magnitude for shock/drop
#define ACCEL_SPEED 30000  // raw magnitude for unsafe driving
#define GAS_THRESHOLD 400  // analog value for leakage
#define HUM_THRESHOLD 80.0 // %RH for condensation risk
#define DAMAGE_CRITICAL 5  // damage score → CRITICAL

// ═══════════════════ WIFI + CLOUD ═══════════════════
const char *ssid = "Wokwi-GUEST";
const char *password = "";

// *** REPLACE WITH YOUR THINGSPEAK API KEY ***
String apiKey = "DLPAJTEOO4ZAEYGR";
String server = "http://api.thingspeak.com/update";

// ═══════════════════ GLOBALS ═══════════════════
DHT dht(DHT_PIN, DHT_TYPE);
LiquidCrystal_I2C lcd(0x27, 16, 2);

float temperature = 0.0;
float humidity = 0.0;
int gasValue = 0;
float accelMag = 0.0;  // acceleration magnitude
float gyroSpeed = 0.0; // simulated gyro speed
int status_code = 1;   // default = OK
int damageScore = 0;
bool tampered = false;

unsigned long lastUpload = 0;
const unsigned long uploadInterval = 15000; // 15 s (ThingSpeak free-tier limit)

unsigned long lastRead = 0;
const unsigned long readInterval = 2000; // 2 s sensor poll

// ═══════════════════ SETUP ═══════════════════
void setup()
{
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("═══════════════════════════════════════════════");
  Serial.println("  🚑 Smart Vaccine Delivery System v2.0");
  Serial.println("═══════════════════════════════════════════════");

  // --- Pin modes ---
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(TAMPER_PIN, INPUT_PULLUP); // button = LOW when pressed
  pinMode(GAS_PIN, INPUT);
  pinMode(ACCEL_X_PIN, INPUT);
  pinMode(ACCEL_Y_PIN, INPUT);

  // --- LCD initialization ---
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Vaccine System");
  lcd.setCursor(0, 1);
  lcd.print("Initializing...");

  // --- DHT22 ---
  dht.begin();
  Serial.println("[OK] DHT22 initialized on GPIO 4");

  // --- For real MPU6050 hardware ---
  // Wire.begin(21, 22);
  // mpu.initialize();
  // if (mpu.testConnection()) Serial.println("[OK] MPU6050 connected");
  Serial.println("[OK] MPU6050 simulated via potentiometers (GPIO 35, 32)");

  Serial.println("[OK] MQ-135 simulated via potentiometer (GPIO 34)");
  Serial.println("[OK] Tamper switch on GPIO 15");

  // --- WiFi ---
  Serial.print("[..] Connecting to WiFi");
  WiFi.begin(ssid, password);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 30)
  {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println("\n[OK] WiFi connected — IP: " + WiFi.localIP().toString());
  }
  else
  {
    Serial.println("\n[!!] WiFi failed — running in offline mode");
  }

  // --- Initial LED/buzzer off ---
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.println("═══════════════════════════════════════════════");
  Serial.println("  System ready. Monitoring started.");
  Serial.println("═══════════════════════════════════════════════");
  Serial.println();
}

// ═══════════════════ MAIN LOOP ═══════════════════
void loop()
{
  unsigned long now = millis();

  // --- Read sensors every 2 s ---
  if (now - lastRead >= readInterval)
  {
    lastRead = now;
    readSensors();
    evaluateStatus();
    handleAlerts();
    printDashboard();
    updateLCD();
  }

  // --- Upload to cloud every 15 s ---
  if (now - lastUpload >= uploadInterval)
  {
    lastUpload = now;
    uploadToCloud();
  }

  delay(10); // Yield to simulator/FreeRTOS — CRITICAL for DHT22 timing
}

// ═══════════════════ SENSOR READING ═══════════════════
void readSensors()
{
  // --- DHT22: Temperature + Humidity ---
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  if (!isnan(t))
  {
    temperature = t;
  }
  if (!isnan(h))
  {
    humidity = h;
  }

  // --- MQ-135 Gas Sensor (potentiometer in Wokwi) ---
  gasValue = analogRead(GAS_PIN);

  // --- MPU6050 Simulation (potentiometers in Wokwi) ---
  // Real hardware: mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
  int rawX = analogRead(ACCEL_X_PIN); // 0-4095
  int rawY = analogRead(ACCEL_Y_PIN); // 0-4095

  // Map pot values (0-4095) to simulated accelerometer range (-32768 to +32767)
  float ax = map(rawX, 0, 4095, -32768, 32767);
  float ay = map(rawY, 0, 4095, -32768, 32767);
  float az = 16384; // ~1g baseline (sitting still)

  accelMag = sqrt(ax * ax + ay * ay + az * az);

  // Simulated gyro speed (derived from acceleration deviation)
  gyroSpeed = abs(ax) + abs(ay);

  // --- Tamper Switch ---
  tampered = (digitalRead(TAMPER_PIN) == LOW);
}

// ═══════════════════ STATUS EVALUATION ═══════════════════
void evaluateStatus()
{
  damageScore = 0;
  status_code = 1; // default: OK

  // --- Temperature check ---
  if (temperature > TEMP_MAX || temperature < TEMP_MIN)
  {
    status_code = 0; // cold-chain failure
    damageScore += 3;
  }

  // --- Tamper check ---
  if (tampered)
  {
    status_code = 2;
    damageScore += 2;
  }

  // --- Shock / drop detection ---
  if (accelMag > ACCEL_SHOCK)
  {
    status_code = 3;
    damageScore += 2;
  }

  // --- Unsafe driving / overspeed ---
  if (gyroSpeed > ACCEL_SPEED)
  {
    status_code = 4;
    damageScore += 1;
  }

  // --- Gas leakage ---
  if (gasValue > GAS_THRESHOLD)
  {
    status_code = 5;
    damageScore += 3;
  }

  // --- High humidity ---
  if (humidity > HUM_THRESHOLD)
  {
    status_code = 6;
    damageScore += 1;
  }

  // --- CRITICAL override ---
  if (damageScore >= DAMAGE_CRITICAL)
  {
    status_code = 9; // CRITICAL
  }
}

// ═══════════════════ ALERT HANDLING ═══════════════════
void handleAlerts()
{
  if (status_code == 1)
  {
    // All good
    digitalWrite(LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
  }
  else if (status_code == 9)
  {
    // CRITICAL — fast blink + continuous buzzer
    digitalWrite(LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
  }
  else
  {
    // Warning — LED on, short buzzer pulse
    digitalWrite(LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
  }
}

// ═══════════════════ SERIAL DASHBOARD ═══════════════════
void printDashboard()
{
  Serial.println("┌─────────────────────────────────────────────┐");
  Serial.println("│       🚑 VACCINE DELIVERY MONITOR           │");
  Serial.println("├─────────────────────────────────────────────┤");
  Serial.printf("│  🌡️  Temperature:  %6.1f °C   [%s-%s]     │\n",
                temperature,
                temperature >= TEMP_MIN ? "✓" : "✗",
                temperature <= TEMP_MAX ? "✓" : "✗");
  Serial.printf("│  💧 Humidity:     %6.1f %%    [%s]          │\n",
                humidity,
                humidity <= HUM_THRESHOLD ? "OK" : "HIGH");
  Serial.printf("│  📊 Acceleration: %8.0f   [%s]          │\n",
                accelMag,
                accelMag <= ACCEL_SHOCK ? "OK" : "SHOCK");
  Serial.printf("│  🏎️  Gyro Speed:   %8.0f   [%s]          │\n",
                gyroSpeed,
                gyroSpeed <= ACCEL_SPEED ? "OK" : "FAST");
  Serial.printf("│  🌫️  Gas Level:    %6d     [%s]          │\n",
                gasValue,
                gasValue <= GAS_THRESHOLD ? "OK" : "LEAK");
  Serial.printf("│  🔒 Tamper:       %s                       │\n",
                tampered ? "OPEN ⚠️" : "SEALED");
  Serial.println("├─────────────────────────────────────────────┤");
  Serial.printf("│  ⚠️  Damage Score: %d / 10                  │\n", damageScore);
  Serial.printf("│  🚦 Status Code:  %d  →  %s │\n",
                status_code, getStatusLabel(status_code));
  Serial.println("└─────────────────────────────────────────────┘");
  Serial.println();

  // --- JSON output for dashboard parsing ---
  Serial.print("DATA:");
  Serial.print("{\"temp\":");
  Serial.print(temperature, 1);
  Serial.print(",\"hum\":");
  Serial.print(humidity, 1);
  Serial.print(",\"gas\":");
  Serial.print(gasValue);
  Serial.print(",\"accel\":");
  Serial.print(accelMag, 0);
  Serial.print(",\"gyro\":");
  Serial.print(gyroSpeed, 0);
  Serial.print(",\"tamper\":");
  Serial.print(tampered ? 1 : 0);
  Serial.print(",\"status\":");
  Serial.print(status_code);
  Serial.print(",\"damage\":");
  Serial.print(damageScore);
  Serial.println("}");
}

// ═══════════════════ STATUS LABELS ═══════════════════
const char *getStatusLabel(int code)
{
  switch (code)
  {
  case 0:
    return "❄️  COLD CHAIN FAILURE   ";
  case 1:
    return "✅ NORMAL / OK           ";
  case 2:
    return "🔓 TAMPER DETECTED       ";
  case 3:
    return "💥 SHOCK / DROP          ";
  case 4:
    return "🏎️  UNSAFE DRIVING       ";
  case 5:
    return "🌫️  GAS LEAKAGE          ";
  case 6:
    return "💧 HIGH HUMIDITY         ";
  case 9:
    return "🚨 CRITICAL !!!          ";
  default:
    return "❓ UNKNOWN               ";
  }
}

// ═══════════════════ LCD UPDATE ═══════════════════
void updateLCD()
{
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Status: ");
  lcd.print(status_code);

  lcd.setCursor(0, 1);
  switch (status_code)
  {
  case 0:
    lcd.print("COLD CHAIN FAIL");
    break;
  case 1:
    lcd.print("NORMAL / OK");
    break;
  case 2:
    lcd.print("TAMPER DETECTED");
    break;
  case 3:
    lcd.print("SHOCK / DROP");
    break;
  case 4:
    lcd.print("UNSAFE DRIVING");
    break;
  case 5:
    lcd.print("GAS LEAKAGE");
    break;
  case 6:
    lcd.print("HIGH HUMIDITY");
    break;
  case 9:
    lcd.print("CRITICAL !!!");
    break;
  default:
    lcd.print("UNKNOWN");
    break;
  }
}

// ═══════════════════ CLOUD UPLOAD ═══════════════════
void uploadToCloud()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("[!!] WiFi disconnected — skipping upload");
    return;
  }

  HTTPClient http;

  String url = server + "?api_key=" + apiKey +
               "&field1=" + String(temperature, 1) +
               "&field2=" + String(humidity, 1) +
               "&field3=" + String(status_code) +
               "&field4=" + String(accelMag, 0) +
               "&field5=" + String(gasValue) +
               "&field6=" + String(damageScore) +
               "&field7=" + String(gyroSpeed, 0) +
               "&field8=" + String(tampered ? 1 : 0);

  Serial.println("[>>] Uploading to ThingSpeak...");

  http.begin(url);
  int httpCode = http.GET();

  if (httpCode > 0)
  {
    Serial.printf("[OK] ThingSpeak response: %d — Entry: %s\n",
                  httpCode, http.getString().c_str());
  }
  else
  {
    Serial.printf("[!!] Upload failed: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}
