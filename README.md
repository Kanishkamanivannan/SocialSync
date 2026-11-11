# SocialSync – Social Media Platform Management System

SocialSync is a modern, unified social media management suite that enables creators, marketing teams, and brand strategists to schedule, analyze, and automate cross-platform social media growth across Instagram, TikTok, Facebook, X (Twitter), LinkedIn, and YouTube from a single pane of glass.

---

## 🌟 Architecture & Features

### 1. Frontend (React 19 + Vite 8)
- **Guided 3-Step Post Creator (`Compose.jsx`)**:
  - Live cross-platform preview for Instagram and X with real-time caption and media rendering.
  - Local image upload (multipart file upload) + URL attachment + quick sample image presets.
  - Hashtag quick-insert pills and character counters (e.g., 280-char X limit).
  - Synchronized platform selector: only enables publishing to active, connected accounts.
  - Optional campaign attribution picker.
- **Interactive Content Calendar (`Calendar.jsx`)**:
  - Full dynamic calendar initialized to real-time month, year, and day.
  - Post status filters: *All Content*, *Scheduled*, *Published*, and *Drafts*.
  - Interactive day selection with chronological agenda list.
  - View post preview modal, edit post modal (modify caption, schedule time, status), and delete action.
- **Analytics & Telemetry (`Analytics.jsx`)**:
  - Recharts AreaChart (Impressions over time) and BarChart (Audience share by platform).
  - Interactive timeframe filters: `7d`, `30d`, `3m`, and `1y`.
  - Export performance report to a downloadable CSV file.
  - Top-performing posts ranking based on database metrics.
- **Campaigns Hub (`Campaigns.jsx`)**:
  - Create, view, edit, and delete campaigns.
  - Status filters (`active`, `planning`, `completed`).
  - Dynamic audience reach progress bar linking actual post metrics to target reach.
- **Connected Accounts (`Accounts.jsx`)**:
  - Multi-network dashboard (Instagram, TikTok, Facebook, X, LinkedIn, YouTube).
  - Connect/Disconnect toggle with instant state persistence.
  - Sync All Accounts button with animated telemetry refresh.
  - Transparent labels for **[Live API]** vs. **[Sandbox Mode]**.
- **Global Search & Notifications (`Navbar.jsx`)**:
  - Real-time debounced global search across posts, accounts, and campaigns with a direct-jump dropdown.
  - Activity notification popover.
  - Dark / Light theme switcher persisted to `localStorage` and `document.documentElement`.
- **User Settings & Diagnostics (`Settings.jsx`)**:
  - Profile customization (Name, Username, Role, Email, and Avatar presets).
  - Notification alert preferences persisted to backend SQLite database.
  - Real-time backend health check and background scheduler status monitor.
- **Dual-Mode Fault Tolerance (`api.js`)**:
  - Targets Python Flask API at `http://127.0.0.1:5000/api`.
  - Automatically switches to browser `localStorage` fallback if the backend server is offline.

---

### 2. Backend (Python 3.13 + Flask 3.1 + SQLite)
- **Security & Authentication**:
  - Passwords hashed using modern `scrypt` via `werkzeug.security`.
  - Cryptographically signed bearer tokens generated with `itsdangerous.URLSafeTimedSerializer`.
  - `@auth_required` decorator for protecting sensitive user operations.
- **Automated Background Post Scheduler**:
  - Dedicated background daemon thread in Flask continuously monitors posts scheduled for release.
  - Automatically transitions overdue posts from `scheduled` to `published` and generates activity logs.
- **Media Uploads Engine**:
  - Multipart file upload handler with extension validation, secure filenames, and static file serving from `/uploads/`.
- **Social Media Integration Architecture (`social_integrations.py`)**:
  - Modular connector architecture prepared for Meta Graph API, X API v2, LinkedIn API, YouTube Data API, and TikTok for Creators.
  - Detects official credentials in environment variables (`INSTAGRAM_ACCESS_TOKEN`, `TWITTER_BEARER_TOKEN`, etc.).
  - Explicitly runs in a clearly labeled **Simulated Sandbox Mode** when credentials are not configured, generating realistic performance telemetry without fabricating live acceptance.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python**: 3.10+ (tested on Python 3.13)
- **Node.js**: 18+ (tested with Vite 8 / npm)

---

### 1. Start the Flask Backend Server

```bash
# Navigate to backend directory
cd backend

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Run database migrations and seed default data (optional, runs automatically on startup)
python database.py

# Run automated backend test suite (48 tests)
python test_api.py

# Start the API server
python app.py
```

The Flask API will start on **`http://127.0.0.1:5000`**.
API Health Check: `http://127.0.0.1:5000/api/health`

---

### 2. Start the Frontend Application

In a separate terminal:

```bash
# Navigate to frontend directory
cd frontend

# Install npm dependencies (if not already installed)
npm install

# Run the development server
npm run dev

# Or build for production
npm run build
```

The Vite dev server will typically run on **`http://localhost:5173`**.

---

## 🔑 Demo Account Credentials

| Attribute | Value |
| :--- | :--- |
| **Email** | `alex@socialsync.io` |
| **Password** | `password123` |
| **1-Click Login** | Available on the Auth screen via the *"1-Click Quick Demo Login"* button |

---

## 🧪 Automated Testing

To run the complete automated test suite covering all 9 core backend modules:

```bash
python backend/test_api.py
```

Expected output:
```text
==================================================
      SOCIALSYNC FULL-STACK TEST RUNNER
==================================================
--- 1. Health & Server Status ---
  [PASS] Health endpoint returns 200
  [PASS] Database is SQLite
  [PASS] Scheduler is active
...
==================================================
TEST RESULTS: 48 PASSED, 0 FAILED
==================================================
```

To run frontend linting and build checks:
```bash
cd frontend
npm run lint
npm run build
```

---

## 📁 Project Structure

```text
socialsync/
├── backend/
│   ├── app.py                   # Main Flask API, endpoints & background daemon scheduler
│   ├── database.py              # SQLite schema, migration, foreign keys & seeding
│   ├── social_integrations.py   # Multi-platform connector & sandbox simulation layer
│   ├── test_api.py              # 48-point automated test suite
│   ├── requirements.txt         # Python dependencies
│   ├── socialsync.db            # SQLite database file
│   └── uploads/                 # Local media storage directory
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx       # Global search, notifications, theme toggle
│   │   │   └── Sidebar.jsx      # Desktop & mobile navigation drawer
│   │   ├── pages/
│   │   │   ├── Splash.jsx       # Splash screen with auto-progress
│   │   │   ├── Onboarding.jsx   # Marketing landing page
│   │   │   ├── Auth.jsx         # Sign in, Sign up, demo quick-login
│   │   │   ├── Dashboard.jsx    # High-level KPIs & upcoming posts feed
│   │   │   ├── Compose.jsx      # Guided 3-step creator & live preview
│   │   │   ├── Calendar.jsx     # Monthly calendar & post CRUD modals
│   │   │   ├── Accounts.jsx     # Channel management & sync
│   │   │   ├── Analytics.jsx    # Charts, date filters & CSV report export
│   │   │   ├── Campaigns.jsx    # Campaign CRUD, goal progress & linked posts
│   │   │   └── Settings.jsx     # Profile, notification toggles & health monitor
│   │   ├── services/
│   │   │   └── api.js           # Full-featured API client with localStorage fallback
│   │   ├── App.jsx              # App root, state orchestration & routing
│   │   ├── App.css              # Responsive layout styles
│   │   └── index.css            # Design tokens & color system
│   ├── package.json
│   └── vite.config.js
└── README.md                    # Project documentation & run guide
```

