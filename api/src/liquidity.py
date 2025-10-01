import pandas as pd
from typing import Dict

def simple_liquidity_stress(
    df: pd.DataFrame,
    deposit_runoff: float = 0.15,
    afs_haircut: float = 0.10
) -> Dict[str, float]:
    hqla = float(df.loc[df["is_cash"], "amount"].sum())
    hqla += float((df.loc[df["is_afs"], "amount"] * (1.0 - afs_haircut)).sum())

    deposits_amt = float(df.loc[df["is_deposit"], "amount"].sum())
    stressed_out = abs(deposits_amt) * deposit_runoff

    coverage = (hqla / stressed_out) if stressed_out else float("inf")

    return {
        "hqla": float(hqla),
        "stressed_outflows": float(stressed_out),
        "coverage_ratio": float(coverage),
    }