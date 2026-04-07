# 🚑 Smart Vaccine Delivery System v2.0

> **IoT-based real-time monitoring system for vaccine cold-chain integrity during transport**

An upgraded IoT simulation that ensures vaccine integrity during transport by monitoring environmental conditions, mechanical stress, and contamination risks in real-time using ESP32, multiple sensors, and cloud analytics.

---

## 🎯 System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    SMART VACCINE DELIVERY SYSTEM                 │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│   DHT22      │  MPU6050     │   MQ-135     │   Tamper Switch    │
│  Temp + Hum  │  Accel/Gyro  │   Gas/Odor   │   Box Security     │
├──────────────┴──────────────┴──────────────┴────────────────────┤
│                        ESP32 DevKit v4                           │
│                    (Processing + WiFi)                           │
├─────────────────────────────────────────────────────────────────┤
│           ┌────────────┐    ┌───────────────┐                   │
│           │  Buzzer 🔊  │    │  Red LED 🔴   │   Alerts          │
│           └────────────┘    └───────────────┘                   │
├─────────────────────────────────────────────────────────────────┤
│                    ThingSpeak Cloud ☁️                            │
│              (Data logging + Visualization)                      │
├─────────────────────────────────────────────────────────────────┤
│                Real-Time Web Dashboard 📊                        │
│      (Gauges, Charts, Alerts, Event Simulation)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧰 Components

| Component | Model | Purpose | Pin(s) |
|-----------|-------|---------|--------|
| Microcontroller | ESP32 DevKit v4 | Processing + WiFi | — |
| Temp/Humidity | DHT22 | Cold-chain monitoring | GPIO 4 |
| Motion Sensor | MPU6050* | Shock/drop detection | GPIO 35, 32 (simulated) |
| Gas Sensor | MQ-135* | Leakage/spoilage detection | GPIO 34 (simulated) |
| Tamper Switch | Push Button | Box-open detection | GPIO 15 |
| Alert Buzzer | Passive Buzzer | Audible warnings | GPIO 13 |
| Alert LED | Red LED | Visual warnings | GPIO 2 |

> \* *Simulated with potentiometers in Wokwi; real I2C/analog code included for physical deployment*

---

## 🚦 Status Code Reference

| Code | Condition | Meaning | Severity |
|------|-----------|---------|----------|
| 0 | Temp < 2°C or > 8°C | Cold chain failure | 🔴 Critical |
| 1 | All normal | OK | 🟢 Normal |
| 2 | Tamper switch triggered | Box opened | 🟡 Warning |
| 3 | Acceleration > 20,000 | Drop / impact | 🔴 Critical |
| 4 | Gyro speed > 30,000 | Unsafe driving | 🟡 Warning |
| 5 | Gas level > 400 | Leakage / spoilage | 🔴 Critical |
| 6 | Humidity > 80% | Condensation risk | 🟡 Warning |
| 9 | Damage Score ≥ 5 | **CRITICAL** | 🔴🔴 Critical |

---

## 🧠 Damage Score Algorithm

The system computes a composite "Damage Score" (0–10) by combining all risk factors:

```
Damage Score = 0

If temp out of range [2–8°C]  → +3
If acceleration > 20,000     → +2
If tamper detected            → +2
If gas > 400                  → +3
If humidity > 80%             → +1
If gyro speed > 30,000       → +1

If total ≥ 5 → STATUS = CRITICAL (9)
```

---

## 📡 ThingSpeak Cloud Fields

| Field | Data | Unit |
|-------|------|------|
| 1 | Temperature | °C |
| 2 | Humidity | %RH |
| 3 | Status Code | 0–9 |
| 4 | Acceleration | raw |
| 5 | Gas Level | analog |
| 6 | Damage Score | 0–10 |
| 7 | Gyro Speed | raw |
| 8 | Tamper State | 0/1 |

---

## 🚀 Quick Start

### 1. Wokwi Simulation

1. Go to [wokwi.com](https://wokwi.com)
2. Create a new **ESP32** project
3. Replace `sketch.ino` content with `firmware/sketch.ino`
4. Replace `diagram.json` content with `firmware/diagram.json`
5. Click **▶ Start Simulation**
6. Use the potentiometer sliders and button to simulate events:
   - **Pot 1 (AccelX)**: Turn right = simulate shock
   - **Pot 2 (AccelY)**: Turn right = simulate shock
   - **Pot 3 (Gas)**: Turn right = simulate gas leak
   - **Red Button**: Press = simulate tamper
   - **DHT22**: Click to change temp/humidity values

### 2. Web Dashboard

1. Open `dashboard/index.html` in any browser
2. The dashboard runs with simulated data automatically
3. Use the **Event Simulator** buttons to test different scenarios:
   - ✅ Normal — All clear
   - 🔥 Heat Exposure — Temperature spike
   - ❄️ Cold Failure — Temperature drop
   - 💥 Drop/Shock — High acceleration
   - 🏎️ Rash Driving — High gyro speed
   - 🌫️ Gas Leakage — High gas levels
   - 💧 High Humidity — Condensation risk
   - 🚨 CRITICAL — Multiple failures at once

### 3. ThingSpeak Setup (Optional)

1. Create an account at [thingspeak.com](https://thingspeak.com)
2. Create a new Channel with 8 fields (see table above)
3. Copy the **Write API Key**
4. Replace `YOUR_THINGSPEAK_API_KEY` in `sketch.ino`
5. Run the simulation — data uploads every 15 seconds

---

## 📁 Project Structure

```
IOT Simulation/
├── firmware/
│   ├── sketch.ino          # ESP32 firmware (sensors + cloud)
│   └── diagram.json        # Wokwi circuit diagram
├── dashboard/
│   ├── index.html          # Web dashboard
│   ├── style.css           # Premium dark theme
│   └── script.js           # Real-time logic + charts
├── docs/
│   └── README.md           # This file
└── wokwi.toml              # Wokwi project config
```

---

## 🔥 Advanced Features

### 🔗 Blockchain Integration (Future)
- Store temperature logs and safety violations as immutable proof
- Hospitals can verify complete chain-of-custody

### 📱 Mobile Alerts (Future)
- ThingSpeak alerts / Telegram bot / ThingsBoard rule engine
- Push notifications on status change

### 📍 Route Safety Analysis (Future)
- Combine GPS + shock data
- Detect bad roads and unsafe routes

---

## 🎓 Presentation Pitch

> *"Our system ensures vaccine integrity during transport by monitoring environmental conditions, mechanical stress, and contamination risks in real time using IoT sensors and cloud analytics. The multi-sensor approach with a composite Damage Score algorithm provides comprehensive safety assessment, while the real-time dashboard enables immediate response to any safety violations."*

### Key Differentiators:
- ✅ **IoT** — ESP32 + multi-sensor integration
- ✅ **Embedded Systems** — Real-time firmware with damage scoring
- ✅ **Cloud Analytics** — ThingSpeak data logging & visualization
- ✅ **Safety Analytics** — Composite risk assessment algorithm
- ✅ **Real-World Healthcare** — Direct impact on vaccine delivery

---

## 📜 License

This project is created for educational/presentation purposes.
