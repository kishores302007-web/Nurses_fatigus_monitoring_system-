# Technology Stack Documentation - Nurse Fatigue Platform

This document details the architectural stack, programming libraries, database engines, and hardware integration protocols used in the Nurse Fatigue Intelligence & Workforce Optimization Platform.

---

## 🎨 1. Frontend Web Portal
The dashboard is designed as a responsive, real-time single-page application (SPA) built on React.

* **React (v18.2)**: Core UI library utilizing functional components, hooks (`useState`, `useEffect`, `useContext`, `useRef`), and Context APIs for global state.
* **Vite (v5.4)**: Dev compiler and bundler optimized for rapid hot reloads (HMR) and production build trees.
* **TypeScript (v5.2)**: Static typing layer defining interfaces for API response bodies, WS messages, and UI props.
* **TailwindCSS (v3.4)**: Utility-first CSS engine mapping out the dark-slate and hospital-teal design system.
* **Recharts (v2.12)**: D3-based charting framework rendering real-time scrolling charts for physiological signals.
* **Lucide React (v0.344)**: Modern UI icon pack.

---

## ⚙️ 2. Backend API Server
The backend handles HTTP request-response cycles, database access, and WebSocket events.

* **FastAPI (v0.110)**: Asynchronous ASGI Python web framework offering high performance and automatic OpenAPI generation.
* **Uvicorn (v0.28)**: Lightning-fast ASGI web server running the FastAPI application loop.
* **SQLAlchemy (v2.0)**: Object-Relational Mapper (ORM) defining the database schemas, relationships, and transaction scopes.
* **Pydantic (v2.6)**: Schema data validation models for request/response serialization.
* **Python-jose (v3.3) & Passlib (v1.7)**: Security hashing and JWT cryptography (using SHA-256) for clinical logins.

---

## 📊 3. Database Engine
* **SQLite (v3.x)**: Serverless SQL database storing relational tables (Users, Nurses, Devices, Shift Rosters, Alerts, Audit Logs, and historical Sensor Records).
* **ChromaDB (v0.4)**: Local Vector database storing markdown document embeddings for semantic searches.

---

## 🧠 4. Machine Learning & Signal Processing
The analytical engine computes clinician fatigue index scores and 2h/4h forecasts.

* **Scikit-Learn (v1.3)**:
  * **Random Forest Regressor**: Fits raw sensor inputs (HRV, SPO2, GSR) and sleep data to project fatigue scores.
  * **Isolation Forest**: Fits telemetry inputs to flag anomalous sensor read deviations (e.g. device falls, detachment).
* **XGBoost (v1.7)**: Gradient boosting regression algorithm calculating multi-hour fatigue progression forecasts.
* **NumPy (v1.24) & Pandas (v2.0)**: Data frame loading, linear algebraic signal calculations, and sliding window features.

---

## 🔌 5. IoT Hardware & Communication Protocols
* **C++ (Arduino IDE)**: Firmware code compiled for ESP32 microcontrollers.
* **MQTT (Message Queuing Telemetry Transport)**: Pub/Sub protocol transporting JSON telemetry payloads over WiFi.
* **WebSockets (ws://)**: Bi-directional server-push protocol streaming live telemetry records to active clients.
