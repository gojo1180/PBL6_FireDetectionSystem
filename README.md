# Fire and Smoke Detection System (IoT PBL6)

A real-time fire and smoke detection system integrating IoT sensors, AI vision, and a modern web dashboard. This project uses Late Fusion logic to combine sensor data (MQTT) and visual inference (YOLOv8) to provide accurate threat detection.

## 🚀 Features

- **Real-time Monitoring**: Live dashboard for sensor data and CCTV streams.
- **AI-Powered Vision**: YOLOv8 model for smoke and fire detection in video streams.
- **Late Fusion Intelligence**: Combines gas, temperature, and visual data to minimize false alarms.
- **Incident Logging**: Automatic logging of detected threats with image evidence.
- **Device Management**: Comprehensive interface for managing sensors and cameras.
- **Secure Authentication**: Protected dashboard access.

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI
- **Real-time Data**: Paho-MQTT
- **AI/ML**: YOLOv8 (Ultralytics), Scikit-learn
- **Database**: Supabase (PostgreSQL)
- **Computer Vision**: OpenCV

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Charts**: Recharts

## 📂 Project Structure

```text
├── backend/            # FastAPI Backend
│   ├── api/            # API Endpoints (v1)
│   ├── core/           # Core logic (MQTT, DB config)
│   ├── ml_models/      # AI Models (YOLOv8 weights)
│   ├── schemas/        # Pydantic models
│   └── services/       # Business logic (Vision, Fusion Engine)
├── frontend/           # Next.js Frontend
│   ├── src/
│   │   ├── app/        # Pages and Routes
│   │   ├── components/ # UI Components
│   │   ├── lib/        # API and Auth utilities
│   │   └── types/      # TypeScript definitions
└── README.md
```

## ⚙️ Setup Instructions

### Backend Setup
1. Navigate to `backend/`
2. Create a virtual environment: `python -m venv venv`
3. Activate it: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Linux/Mac)
4. Install dependencies: `pip install -r requirements.txt`
5. Configure `.env` with Supabase and MQTT credentials.
6. Run the server: `python main.py` or `uvicorn main:app --reload`

### Frontend Setup
1. Navigate to `frontend/`
2. Install dependencies: `npm install`
3. Configure `.env.local` with your Backend URL and Supabase keys.
4. Run development server: `npm run dev`

## 🤝 Contributing
Push changes to the `main` branch after review.

## 📄 License
This project is part of the PBL6 curriculum.
