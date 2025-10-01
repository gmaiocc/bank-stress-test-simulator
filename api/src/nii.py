from typing import Dict
import pandas as pd
import numpy as np

def project_nii_12m(
    df: pd.DataFrame,
    shock_bps: int,
    liab_beta_col: str = "deposit_beta_eff",
) -> Dict[str, float]:

    required = {"side", "rate", "amount"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns for NII: {sorted(list(missing))}")

    non_equity = df[df["side"].isin(["asset", "liability"])].copy()

    for col in ["rate", "amount", "float_share"]:
        if col in non_equity.columns:
            non_equity[col] = pd.to_numeric(non_equity[col], errors="coerce")
        else:
            non_equity[col] = 0.0
    if liab_beta_col in non_equity.columns:
        non_equity[liab_beta_col] = pd.to_numeric(non_equity[liab_beta_col], errors="coerce")
    else:
        non_equity[liab_beta_col] = 0.0

    non_equity[["rate", "amount", "float_share", liab_beta_col]] = \
        non_equity[["rate", "amount", "float_share", liab_beta_col]].fillna(0.0)

    dy = shock_bps / 10_000.0
    baseline_nii = float((non_equity["rate"] * non_equity["amount"]).sum())
    post_rate = non_equity["rate"].copy()
    is_asset = non_equity["side"].eq("asset")
    is_liab  = non_equity["side"].eq("liability")
    post_rate.loc[is_asset] = non_equity.loc[is_asset, "rate"] + non_equity.loc[is_asset, "float_share"] * dy
    post_rate.loc[is_liab]  = non_equity.loc[is_liab,  "rate"] + non_equity.loc[is_liab,  liab_beta_col] * dy
    non_equity["post_rate"] = post_rate
    post_nii = float((non_equity["post_rate"] * non_equity["amount"]).sum())

    return {
        "shock_bps": float(shock_bps),
        "baseline_nii": baseline_nii if np.isfinite(baseline_nii) else 0.0,
        "post_nii": post_nii if np.isfinite(post_nii) else 0.0,
        "delta_nii": (post_nii - baseline_nii) if (np.isfinite(post_nii) and np.isfinite(baseline_nii)) else 0.0,
    }