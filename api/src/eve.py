from typing import Dict
import numpy as np
import pandas as pd

def _delta_pv_dur_conv(amount: float, duration: float, dy: float, convexity: float = 0.0) -> float:
    return amount * (-duration * dy + 0.5 * convexity * (dy ** 2))

def eve_change(df: pd.DataFrame, shock_bps: int) -> Dict:
    dy = shock_bps / 10_000.0

    for col in ("amount", "duration", "convexity"):
        if col not in df.columns:
            df[col] = 0.0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    equity = float(pd.to_numeric(df.loc[df["side"].eq("equity"), "amount"], errors="coerce").fillna(0.0).sum())
    non_equity = df[df["side"].isin(["asset", "liability"])].copy()

    delta_pv = non_equity["amount"] * (-non_equity["duration"] * dy + 0.5 * non_equity["convexity"] * (dy ** 2))
    non_equity = non_equity.assign(delta_pv=delta_pv)

    assets = non_equity[non_equity["side"].eq("asset")]
    liabs  = non_equity[non_equity["side"].eq("liability")]

    assets_sum = float(assets["delta_pv"].sum())
    liabs_sum  = float(liabs["delta_pv"].sum())
    delta_eve  = assets_sum + liabs_sum

    return {
        "shock_bps": shock_bps,
        "assets_delta_pv": assets_sum,
        "liabs_delta_pv": liabs_sum,
        "delta_eve": delta_eve,
        "equity": float(equity),
        "delta_eve_pct_equity": float(delta_eve / equity) if equity else np.nan,
        "by_asset": assets[["name", "delta_pv"]].to_dict(orient="records"),
        "by_liab":  liabs[["name", "delta_pv"]].to_dict(orient="records"),
    }