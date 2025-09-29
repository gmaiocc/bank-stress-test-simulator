# Bank Stress-Test Simulator
**Version 1.0.0**

A minimal, educational simulator for bank balance-sheet stress testing.  
It estimates **EVE (Economic Value of Equity)** under interest-rate shocks, a simple **12-month NII** projection, and a basic **liquidity coverage** check (HQLA vs deposit outflows).

---

## Demo Preview  

![Demo GIF](./frontend/public/gifs/gifbankstresstest.gif)  
*Example of the simulator running with sample data.*

---

## Features

- **CSV upload** with auto-delimiter detection  
- **Schema validation** with error reporting and exportable reports  
- **Configurable parameters** (AFS haircut, deposit runoff, betas, shocks)  
- **Metrics:**  
  - ΔEVE / Equity  
  - ΔNII (12m)  
  - Liquidity (HQLA, outflows, coverage)  
- **Interactive charts** with export to PNG  
- **Table view** with filtering, sorting, pagination, and CSV/JSON export  
- **Built-in sample datasets** (`small.csv`, `medium.csv`, `large.csv`) for quick testing  
- **Bilingual UI** (EN/PT) with automatic detection and toggle  

---

## How It Works

1. **Upload CSV** with balance sheet items (assets, liabilities, equity).  
   Required columns:  
   `type, name, amount, rate, duration, category, fixed_float, float_share, repricing_bucket`  
2. **Set parameters**: deposit runoff, deposit betas, AFS haircut, interest rate shocks.  
3. **Run stress test** → Results show ΔEVE, ΔNII, and liquidity coverage across scenarios.  
4. **Preview & export** results as CSV.

---

## Tech Stack  

- **Frontend:** React + TypeScript + Vite + TailwindCSS + Framer Motion  
- **Backend:** FastAPI + Pandas  
- **Charts:** Recharts  
- **Validation:** Zod + Papaparse  
- **UI Components:** shadcn/ui + Lucide icons  

---

## How to Run Locally

### Backend (FastAPI)
```bash
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
# Open http://localhost:8000/docs for API
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```