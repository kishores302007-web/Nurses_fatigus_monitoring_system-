# ESP32 IoT Wearable Device - Hardware Wiring & Setup Guide

This guide details the physical wiring, system libraries, and compilation instructions for assembling the ESP32-based wearable device used in the **Nurse Fatigue Intelligence & Workforce Optimization Platform**.

---

## 1. Pin Wiring Interconnection Matrix

All I2C sensors share the standard ESP32 I2C bus (SDA on GPIO 21, SCL on GPIO 22). Each sensor has a unique I2C hardware address, allowing them to co-exist on the same communication wires.

| Sensor Module | Sensor Pin | ESP32 Pin | Voltage Level | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **MAX30102** (PPG / Heart Rate) | VCC | 3.3V | 3.3V | Bio-telemetry PPG |
| | GND | GND | GND | Common Ground |
| | SDA | GPIO 21 | 3.3V | Shared I2C Data |
| | SCL | GPIO 22 | 3.3V | Shared I2C Clock |
| **MLX90614** (Infrared Temp) | VCC | 3.3V | 3.3V | Skin Temperature |
| | GND | GND | GND | Common Ground |
| | SDA | GPIO 21 | 3.3V | Shared I2C Data |
| | SCL | GPIO 22 | 3.3V | Shared I2C Clock |
| **MPU6050** (6-Axis IMU) | VCC | 3.3V | 3.3V | Motion/Sleep variance |
| | GND | GND | GND | Common Ground |
| | SDA | GPIO 21 | 3.3V | Shared I2C Data |
| | SCL | GPIO 22 | 3.3V | Shared I2C Clock |
| **GSR Sensor** (Skin Conductance) | VCC | 3.3V | 3.3V | Stress level |
| | GND | GND | GND | Common Ground |
| | OUT / SIG | GPIO 34 | Analog 0-3.3V | Connect to Analog Pin ADC1 |

---

## 2. Required Arduino IDE Libraries

Before compiling the `esp32_firmware.ino` sketch, open the **Library Manager** (`Ctrl+Shift+I` or `Cmd+Shift+I`) in Arduino IDE and install the following libraries:

1. **Adafruit MLX90614 Library** (by Adafruit) - version `2.1.3+`
2. **Adafruit MPU6050** (by Adafruit) - version `2.2.4+`
3. **Adafruit Unified Sensor** (dependency for MPU6050)
4. **SparkFun MAX3010x Pulse Oximeter** (by SparkFun) - version `1.1.2+`
5. **PubSubClient** (by Nick O'Leary) - version `2.8.0+` (Used for MQTT client communication)

---

## 3. Setup and Compilation Steps

1. **Install ESP32 Board Manager**:
   - In Arduino IDE, navigate to `File` -> `Preferences`.
   - In "Additional Boards Manager URLs", add:
     `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Go to `Tools` -> `Board` -> `Boards Manager`, search for `esp32` (by Espressif Systems), and click **Install**.

2. **Select Board & Port**:
   - Connect the ESP32 node to your PC using a USB data cable.
   - Go to `Tools` -> `Board` -> `ESP32 Arduino` -> Select your module (e.g., **ESP32 Dev Module**).
   - Go to `Tools` -> `Port` and select the active COM port assigned to the device.

3. **Configure Wi-Fi Credentials**:
   - Open `hardware/esp32_firmware/esp32_firmware.ino` in Arduino IDE.
   - Update `ssid` and `password` variables to match your local router credentials.
   - Update `mqtt_server` to point to the IP address of your host PC running the FastAPI ingestion server.

4. **Verify and Upload**:
   - Click the checkmark icon (**Verify**) in the top-left to compile the code.
   - Click the arrow icon (**Upload**) to flash the ESP32 board.
   - Open the **Serial Monitor** (`Ctrl+Shift+M`) at `115200` baud rate to inspect the sensor initialization status and check live JSON outputs.

---

## 4. Calibration & Testing Protocol

- **MAX30102 PPG**: Ensure the sensor lens makes gentle, flush contact with the finger skin. Excessive pressure can restrict blood flow and distort the signal.
- **GSR Calibration**: Adjust the onboard potentiometer on the GSR module until the output voltage reads roughly **2.2V** in a resting, non-sweaty state. Sweat will increase conductance and decrease the analog voltage output.
- **MPU6050**: Place the wearable flat on a desk during initial bootup. The sensor establishes gravitational baseline parameters (Z-axis around `-9.8m/s²`).
