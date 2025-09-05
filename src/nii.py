import pandas as pd

def project_nii_12m(df: pd.DataFrame, shock_bps: int) -> dict:
    dy = shock_bps / 10000.0

    assets = df[df["type"] == "asset"].copy()
    liabs  = df[df["type"] == "liability"].copy()

    # Baseline NII
    baseline_int_income = (assets["rate"] * assets["amount"]).sum()
    baseline_int_exp    = (liabs["rate"]  * liabs["amount"]).sum()
    baseline_nii = baseline_int_income - baseline_int_exp

    # After shock
    assets["post_rate"] = assets["rate"] + assets["float_share"] * dy
    # Liabs: depósitos/wholesale com betas
    liabs["post_rate"] = liabs["rate"] + liabs["deposit_beta"] * dy

    post_int_income = (assets["post_rate"] * assets["amount"]).sum()
    post_int_exp    = (liabs["post_rate"]  * liabs["amount"]).sum()
    post_nii = post_int_income - post_int_exp

    return {
        "shock_bps": shock_bps,
        "baseline_nii": float(baseline_nii),
        "post_nii": float(post_nii),
        "delta_nii": float(post_nii - baseline_nii),
    }