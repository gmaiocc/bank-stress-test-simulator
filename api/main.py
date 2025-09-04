from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List
import pandas as pd
from io import StringIO

# Your modules
from src.eve import eve_change
from src.nii import project_nii_12m
# from src.liquidity import simple_liquidity_stress  # not used directly (we inline params)

app = FastAPI(title="Bank Stress Test API", version="0.1.0")

# --- CORS (frontend Vite em 5173) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],   # inclui OPTIONS/POST
    allow_headers=["*"],
)

# --- Health / root ---
@app.get("/")
def root():
    return {"status": "ok", "message": "Bank Stress Test API. See /docs"}

@app.get("/health")
def health():
    return {"status": "healthy"}

# --- Models ---
class StressParams(BaseModel):
    shocks_bps: List[int] = Field(default=[-200, -100, 0, 100, 200, 300])
    afs_haircut: float = Field(default=0.10, ge=0.0, le=0.5)
    deposit_runoff: float = Field(default=0.15, ge=0.0, le=1.0)
    deposit_beta_core: float = Field(default=0.30, ge=0.0, le=1.0)
    deposit_beta_noncore: float = Field(default=0.60, ge=0.0, le=1.0)
    lag_months: int = Field(default=1, ge=0, le=12)

class StressRequest(BaseModel):
    csv_text: str
    params: StressParams

class ScenarioResult(BaseModel):
    shock_bps: int
    eve_change: float
    eve_pct_equity: float
    nii_delta: float
    lcr_hqla: float
    lcr_outflows: float
    lcr_coverage: float

class StressResponse(BaseModel):
    equity: float
    results: List[ScenarioResult]

# --- Helpers ---
def _read_csv_text(csv_text: str) -> pd.DataFrame:
    df = pd.read_csv(StringIO(csv_text))
    required = {"type","name","amount","rate","duration","category","fixed_float","float_share","repricing_bucket"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {sorted(list(missing))}")

    df["type"] = df["type"].str.lower()
    df["fixed_float"] = df["fixed_float"].str.lower()
    df["float_share"] = df["float_share"].fillna(0.0).astype(float)
    df["amount"] = df["amount"].astype(float)
    df["rate"] = df["rate"].astype(float)
    df["duration"] = df["duration"].astype(float)
    if "deposit_beta" not in df.columns: df["deposit_beta"] = 0.0
    df["deposit_beta"] = df["deposit_beta"].fillna(0.0).astype(float)
    df["category"] = df["category"].str.upper()
    if "stability" not in df.columns: df["stability"] = ""
    return df

def _liq_with_params(df_in: pd.DataFrame, afs_haircut: float, deposit_runoff: float):
    assets = df_in[df_in["type"] == "asset"].copy()
    hqla = 0.0
    for _, r in assets.iterrows():
        if r["name"].lower() == "cash":
            hqla += r["amount"]
        elif r["category"] == "AFS":
            hqla += r["amount"] * (1.0 - afs_haircut)
    deposits = df_in[(df_in["type"]=="liability") & (df_in["category"]=="DEPOSITS")]["amount"].sum()
    stressed_outflows = deposits * deposit_runoff
    coverage = hqla / stressed_outflows if stressed_outflows else float("inf")
    return {"hqla": float(hqla), "stressed_outflows": float(stressed_outflows), "coverage_ratio": float(coverage)}

# --- Preflight explícito (evita 405 no OPTIONS /stress) ---
@app.options("/stress")
def options_stress():
    return Response(status_code=204)

@app.options("/stress/")
def options_stress_slash():
    return Response(status_code=204)

# --- Endpoint principal ---
@app.post("/stress", response_model=StressResponse)
@app.post("/stress/", response_model=StressResponse)
def run_stress(req: StressRequest):
    df = _read_csv_text(req.csv_text)

    # Override deposit betas by stability (core vs noncore)
    def _beta(row):
        if row["type"] == "liability" and row["category"] == "DEPOSITS":
            st = (row.get("stability") or "").lower()
            return req.params.deposit_beta_core if st == "core" else req.params.deposit_beta_noncore
        return row.get("deposit_beta", 0.0)

    df["deposit_beta"] = df.apply(_beta, axis=1)

    equity = float(df[df["type"]=="equity"]["amount"].sum())
    out_rows: List[ScenarioResult] = []

    for s in req.params.shocks_bps:
        eve_res = eve_change(df, s)
        nii_res = project_nii_12m(df, s)  # (podes incluir lag no futuro)
        liq_res = _liq_with_params(df, req.params.afs_haircut, req.params.deposit_runoff)

        out_rows.append(ScenarioResult(
            shock_bps=s,
            eve_change=float(eve_res["delta_eve"]),
            eve_pct_equity=float(eve_res["delta_eve_pct_equity"]),
            nii_delta=float(nii_res["delta_nii"]),
            lcr_hqla=float(liq_res["hqla"]),
            lcr_outflows=float(liq_res["stressed_outflows"]),
            lcr_coverage=float(liq_res["coverage_ratio"]),
        ))

    return StressResponse(equity=float(equity), results=out_rows)