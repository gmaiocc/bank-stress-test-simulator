from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Dict
import os
import pandas as pd
from io import StringIO

from src.eve import eve_change
from src.nii import project_nii_12m

APP_VERSION = "1.0.0"
MAX_CSV_MB = float(os.getenv("MAX_CSV_MB", "10"))

def _allowed_origins() -> list[str]:
    env = os.getenv("ALLOWED_ORIGINS", "")
    if env.strip():
        return [o.strip() for o in env.split(",") if o.strip()]
    return ["http://localhost:5173", "http://127.0.0.1:5173"]

app = FastAPI(title="Bank Stress Test API", version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok", "message": "Bank Stress Test API. See /docs", "version": APP_VERSION}

@app.get("/health")
def health():
    return {"status": "healthy", "version": APP_VERSION}

class StressParams(BaseModel):
    shocks_bps: List[int] = Field(default=[-200, -100, 0, 100, 200])
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

REQUIRED = {"type","name","amount","rate","duration","category","fixed_float","float_share","repricing_bucket"}

def _normalize_df(df: pd.DataFrame) -> pd.DataFrame:
    missing = REQUIRED - set(df.columns)
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {sorted(list(missing))}")

    df = df.copy()
    df["type"] = df["type"].astype(str).str.lower()
    df["name"] = df["name"].astype(str)
    df["fixed_float"] = df["fixed_float"].astype(str).str.lower()
    df["category"] = df["category"].astype(str)
    df["category_up"] = df["category"].str.upper()

    for col in ["amount", "rate", "duration", "float_share"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0).astype(float)

    if "deposit_beta" not in df.columns:
        df["deposit_beta"] = 0.0
    df["deposit_beta"] = pd.to_numeric(df["deposit_beta"], errors="coerce").fillna(0.0).astype(float)

    if "stability" not in df.columns:
        df["stability"] = ""
    df["stability"] = df["stability"].astype(str).str.lower()

    def infer_side(row):
        c = row["category"].lower()
        t = row["type"].lower()
        if c in {"asset", "liability", "equity"}: return c
        if t in {"asset", "liability", "equity"}: return t
        if "equity" in row["name"].lower() or t == "equity": return "equity"
        return "asset" if row["amount"] >= 0 else "liability"

    df["side"] = df.apply(infer_side, axis=1)
    df["is_cash"] = df["name"].str.lower().eq("cash")
    df["is_afs"] = df["category_up"].eq("AFS")
    df["is_deposit"] = (df["side"].eq("liability")) & (
        df["name"].str.contains("deposit", case=False) | df["category_up"].eq("DEPOSITS")
    )
    return df

def _read_csv_text(csv_text: str) -> pd.DataFrame:
    if not isinstance(csv_text, str) or not csv_text.strip():
        raise HTTPException(status_code=400, detail="csv_text is empty.")
    approx_mb = len(csv_text.encode("utf-8")) / (1024 * 1024)
    if approx_mb > MAX_CSV_MB:
        raise HTTPException(status_code=413, detail=f"CSV too large (> {MAX_CSV_MB} MB).")
    txt = csv_text.lstrip("\ufeff").strip()
    try:
        df = pd.read_csv(StringIO(txt))
    except Exception:
        df = pd.read_csv(StringIO(txt), sep=None, engine="python")
    return _normalize_df(df)

def _liq_with_params(df_in: pd.DataFrame, afs_haircut: float, deposit_runoff: float) -> Dict[str, float]:
    df = df_in
    hqla = float(df.loc[df["is_cash"], "amount"].sum())
    hqla += float((df.loc[df["is_afs"], "amount"] * (1.0 - afs_haircut)).sum())
    deposits_amt = float(df.loc[df["is_deposit"], "amount"].sum())
    stressed_out = abs(deposits_amt) * float(deposit_runoff)
    coverage = (hqla / stressed_out) if stressed_out else float("inf")
    return {"hqla": float(hqla), "stressed_outflows": float(stressed_out), "coverage_ratio": float(coverage)}

@app.options("/stress")
@app.options("/stress/")
def options_stress():
    return Response(status_code=204)

@app.get("/stress")
def ping_stress():
    return {"ok": True, "message": "POST CSV to this endpoint."}

@app.post("/stress", response_model=StressResponse)
@app.post("/stress/", response_model=StressResponse)
def run_stress(req: StressRequest):
    df = _read_csv_text(req.csv_text)

    def _row_beta(row):
        if row["is_deposit"]:
            return req.params.deposit_beta_core if row["stability"] == "core" else req.params.deposit_beta_noncore
        return row["deposit_beta"]

    df["deposit_beta_eff"] = df.apply(_row_beta, axis=1)

    equity_sum = float(df.loc[df["side"].eq("equity"), "amount"].sum())
    equity_base = abs(equity_sum)
    if equity_base == 0:
        raise HTTPException(status_code=400, detail="Equity base is zero. Check the CSV.")

    out_rows: List[ScenarioResult] = []
    for s in req.params.shocks_bps:
        eve_res = eve_change(df, s)
        nii_res = project_nii_12m(df, s, liab_beta_col="deposit_beta_eff")
        liq_res = _liq_with_params(df, req.params.afs_haircut, req.params.deposit_runoff)
        out_rows.append(ScenarioResult(
            shock_bps=s,
            eve_change=float(eve_res["delta_eve"]),
            eve_pct_equity=float(eve_res["delta_eve"] / equity_base),
            nii_delta=float(nii_res["delta_nii"]),
            lcr_hqla=float(liq_res["hqla"]),
            lcr_outflows=float(liq_res["stressed_outflows"]),
            lcr_coverage=float(liq_res["coverage_ratio"]),
        ))
    return StressResponse(equity=float(equity_base), results=out_rows)