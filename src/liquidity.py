import pandas as pd

def simple_liquidity_stress(df: pd.DataFrame, deposit_runoff: float = 0.15) -> dict:
    # HQLA proxy: Cash + AFS_Bonds 
    assets = df[df["type"] == "asset"].copy()
    hqla = 0.0
    for _, r in assets.iterrows():
        if r["name"].lower() == "cash":
            hqla += r["amount"]
        elif r["category"] == "AFS":
            hqla += r["amount"] * 0.90  

    deposits = df[(df["type"]=="liability") & (df["category"]=="DEPOSITS")]["amount"].sum()
    stressed_outflows = deposits * deposit_runoff

    coverage = hqla / stressed_outflows if stressed_outflows else float("inf")
    return {
        "hqla": float(hqla),
        "stressed_outflows": float(stressed_outflows),
        "coverage_ratio": float(coverage)
    }