# 🧠 Ingestion Batch Processor API

This is a Node.js + Express API that allows clients to send a list of IDs and receive a unique ingestion ID. The IDs are processed in batches with prioritization and delay control. Each ingestion can be tracked using the status API.

---

## 🚀 Hosted URL

> 🌐 Base URL: `https://loop-ai-v8ro.onrender.com`  
---

## 📦 How the App Works (Simple Explanation)

- When you send a list of IDs to `/ingest`, the app:
  - Breaks them into **batches of 3**.
  - Assigns a **priority** (HIGH, MEDIUM, LOW).
  - Gives each batch and ingestion a **unique ID** (using `uuid`).
  - Stores everything temporarily in memory (`store` object).
  - Starts processing batches **one by one**, respecting priority and adding a **5-second gap** between them.

- You can check the status anytime using the **ingestion ID** at `/status/:ingestionId`.

---

## 📘 API Endpoints

### ✅ Base API
**`https://loop-ai-v8ro.onrender.com/base`**  
Returns a simple JSON to verify the API is running.

**Response:**
```json
"Base route"
```

### ✅ Post Api
**`https://loop-ai-v8ro.onrender.com/ingest`**  
Returns a simple ingestion id

**Response:**
```json
"ingestion_id": "660a6af1-c526-4088-90d0-9dd2ac62fda6"
```

### ✅ Get Api
**`https://loop-ai-v8ro.onrender.com/status/660a6af1-c526-4088-90d0-9dd2ac62fda6`**  
Returns a json that contains all important information

**Response:**
```json
    "ingestion_id": "660a6af1-c526-4088-90d0-9dd2ac62fda6",
    "status": "completed",
    "batches": [
        {
            "batch_id": "d31ce9d1-1d65-4595-9959-f0e549ffafd0",
            "ids": [
                1,
                2,
                3
            ],
            "status": "completed"
        },
        {
            "batch_id": "6efaed4e-e414-4880-9d49-bd02097b307c",
            "ids": [
                4,
                5
            ],
            "status": "completed"
        }
    ]
```
