from typing import Dict
import pandas as pd

def project_nii_12m(
    df: pd.DataFrame,
    shock_bps: int,
    liab_beta_col: str = "deposit_beta_eff",
) -> Dict:
    dy = shock_bps / 10_000.0

    non_equity = df[df["side"].isin(["asset", "liability"])].copy()

    baseline_nii = float((non_equity["rate"] * non_equity["amount"]).sum())

    post_rate = non_equity["rate"].copy()
    is_asset = non_equity["side"].eq("asset")
    is_liab  = non_equity["side"].eq("liability")

    post_rate.loc[is_asset] = non_equity.loc[is_asset, "rate"] + non_equity.loc[is_asset, "float_share"] * dy
    post_rate.loc[is_liab]  = non_equity.loc[is_liab,  "rate"] + non_equity.loc[is_liab,  liab_beta_col] * dy

    non_equity["post_rate"] = post_rate

    post_nii = float((non_equity["post_rate"] * non_equity["amount"]).sum())

    return {
        "shock_bps": shock_bps,
        "baseline_nii": baseline_nii,
        "post_nii": post_nii,
        "delta_nii": post_nii - baseline_nii,
    }