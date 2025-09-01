import numpy as np
import pandas as pd

def _delta_pv_duration(amount: float, duration: float, shock_bps: int) -> float:
    dy = shock_bps / 10000.0  # bps -> decimal
    # ΔPV ≈ -D * Δy * Amount (aproximação)
    return -duration * dy * amount

def eve_change(df: pd.DataFrame, shock_bps: int) -> dict:
    assets = df[df["type"] == "asset"].copy()
    liabs  = df[df["type"] == "liability"].copy()
    equity = df[df["type"] == "equity"]["amount"].sum()

    # Assets ΔPV
    assets["delta_pv"] = assets.apply(
        lambda r: _delta_pv_duration(r["amount"], r["duration"], shock_bps), axis=1
    )
    # Liabilities ΔPV (sinal inverso na ótica do banco: PV de passivos a subir taxas desce => melhora EVE)
    liabs["delta_pv"] = liabs.apply(
        lambda r: -_delta_pv_duration(r["amount"], r["duration"], shock_bps), axis=1
    )

    total_assets_dp = assets["delta_pv"].sum()
    total_liabs_dp = liabs["delta_pv"].sum()

    delta_eve = total_assets_dp + total_liabs_dp
    out = {
        "shock_bps": shock_bps,
        "assets_delta_pv": float(total_assets_dp),
        "liabs_delta_pv": float(total_liabs_dp),
        "delta_eve": float(delta_eve),
        "equity": float(equity),
        "delta_eve_pct_equity": float(delta_eve / equity) if equity else np.nan,
        "by_asset": assets[["name","delta_pv"]].to_dict(orient="records"),
        "by_liab": liabs[["name","delta_pv"]].to_dict(orient="records"),
    }
    return out