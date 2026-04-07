import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import os

np.random.seed(42)
t = np.arange(0, 120)

# Sensor data simulation
temp = 5.0 + np.sin(t / 15.0) * 2.5 + np.random.normal(0, 0.3, 120)
hum = 45 + np.sin(t / 20.0) * 8 + np.random.normal(0, 1.5, 120)
accel = 16384 + np.random.normal(0, 500, 120)
accel[50:55] = 25000 + np.random.normal(0, 1000, 5)  # Shock event
gas = 80 + np.random.normal(0, 15, 120)
gas[70:78] = 500 + np.random.normal(0, 30, 8)  # Gas leak
damage = np.zeros(120)
damage[50:55] = 4
damage[70:78] = 7

fig, axes = plt.subplots(2, 3, figsize=(14, 7), facecolor='#f5f5f5')
fig.suptitle('Smart Vaccine Delivery — ThingSpeak Channel', fontsize=16, fontweight='bold', color='#333')

datasets = [
    (temp, 'Field 1: Temperature (°C)', '#e74c3c', (2, 8)),
    (hum, 'Field 2: Humidity (%RH)', '#3498db', (30, 80)),
    (accel, 'Field 3: Acceleration', '#e67e22', None),
    (gas, 'Field 4: Gas Level (ppm)', '#9b59b6', None),
    (damage, 'Field 5: Damage Score', '#1abc9c', (0, 10)),
]

for i, (data, title, color, ylim) in enumerate(datasets):
    ax = axes[i // 3][i % 3]
    ax.plot(t, data, color=color, linewidth=1.2, alpha=0.9)
    ax.fill_between(t, data, alpha=0.1, color=color)
    ax.set_title(title, fontsize=10, fontweight='bold', color='#444')
    ax.grid(True, alpha=0.3, linestyle='--')
    ax.set_facecolor('#ffffff')
    if ylim:
        ax.set_ylim(ylim)
    ax.tick_params(labelsize=7)

# Status code
status = np.ones(120)
status[50:55] = 3
status[70:78] = 5
ax = axes[1][2]
ax.step(t, status, color='#c0392b', linewidth=1.5)
ax.set_title('Field 6: Status Code', fontsize=10, fontweight='bold', color='#444')
ax.set_ylim(-0.5, 6)
ax.grid(True, alpha=0.3, linestyle='--')
ax.set_facecolor('#ffffff')
ax.tick_params(labelsize=7)

plt.tight_layout(rect=[0, 0, 1, 0.93])
plt.savefig('images/thingspeak_channel.png', dpi=150, bbox_inches='tight', facecolor='#f5f5f5')
plt.close()
print("ThingSpeak chart saved to images/thingspeak_channel.png")

# Also generate a serial monitor style output
fig2, ax2 = plt.subplots(figsize=(8, 5), facecolor='#1e1e2e')
ax2.set_facecolor('#1e1e2e')
ax2.axis('off')

serial_text = """╔══════════════════════════════════════════╗
║  Smart Vaccine Delivery System v2.0      ║
║  ESP32 Cold-Chain Monitor                ║
╠══════════════════════════════════════════╣
║  Temp:   5.1°C     [OK  2-8°C]          ║
║  Humid:  44.8%     [OK  <80%]           ║
║  Accel:  16439     [OK  <20000]         ║
║  Gyro:   15234     [OK  <30000]         ║
║  Gas:    80 ppm    [OK  <400]           ║
║  Tamper: SEALED    [OK]                 ║
╠══════════════════════════════════════════╣
║  Damage Score: 0/10                      ║
║  Status: 1 (ALL NORMAL)                  ║
║  WiFi: Connected (Wokwi-GUEST)           ║
║  ThingSpeak: Upload OK (200)             ║
╚══════════════════════════════════════════╝

DATA:{"temp":5.1,"hum":44.8,"accel":16439,
      "gyro":15234,"gas":80,"tamper":0,
      "damage":0,"status":1}
"""
ax2.text(0.05, 0.95, serial_text, transform=ax2.transAxes,
         fontsize=10, fontfamily='monospace', color='#50c878',
         verticalalignment='top', horizontalalignment='left')

plt.savefig('images/serial_monitor.png', dpi=150, bbox_inches='tight', facecolor='#1e1e2e')
plt.close()
print("Serial monitor saved to images/serial_monitor.png")
