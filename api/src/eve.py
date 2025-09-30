from typing import Dict
import numpy as np
import pandas as pd

def _delta_pv_duration(amount: float, duration: float, shock_bps: int) -> float:
    dy = shock_bps / 10_000.0
    return -duration * dy * amount

def eve_change(df: pd.DataFrame, shock_bps: int) -> Dict:
    assets = df[df["side"] == "asset"].copy()
    liabs  = df[df["side"] == "liability"].copy()
    equity = float(df[df["side"] == "equity"]["amount"].sum())

    assets["delta_pv"] = assets.apply(lambda r: _delta_pv_duration(r["amount"], r["duration"], shock_bps), axis=1)
    liabs["delta_pv"]  = liabs.apply( lambda r: _delta_pv_duration(r["amount"],  r["duration"], shock_bps), axis=1)

    delta_eve = float(assets["delta_pv"].sum() + liabs["delta_pv"].sum())

    return {
        "shock_bps": shock_bps,
        "assets_delta_pv": float(assets["delta_pv"].sum()),
        "liabs_delta_pv": float(liabs["delta_pv"].sum()),
        "delta_eve": delta_eve,
        "equity": float(equity),
        "delta_eve_pct_equity": float(delta_eve / equity) if equity else np.nan, 
        "by_asset": assets[["name", "delta_pv"]].to_dict(orient="records"),
        "by_liab": liabs[["name", "delta_pv"]].to_dict(orient="records"),
    }