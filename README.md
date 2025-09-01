# Bank Stress-Test Simulator

A minimal, educational simulator for bank balance-sheet stress testing.  
It estimates **EVE (Economic Value of Equity)** impact under interest-rate shocks, a simple **12-month NII** projection with deposit betas, and a basic **liquidity run-off** check.

## Features (MVP)
- Parallel rate shocks (±200 bps)
- Duration-based ΔPV and EVE
- 12-month NII with floating-rate shares and deposit betas
- Simple liquidity coverage proxy (HQLA vs stressed outflows)

## Roadmap
- Convexity and non-parallel shocks (steepener/flattener)
- Repricing buckets for timing effects on NII
- LCR/NSFR-style liquidity modelling
- Streamlit UI and PDF reporting

## How to run
```bash
pip install -r requirements.txt
python app.py