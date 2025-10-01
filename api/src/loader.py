import pandas as pd

REQUIRED = {
    "type", "name", "amount", "rate", "duration",
    "category", "fixed_float", "float_share", "repricing_bucket"
}

def load_balance_sheet(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)

    missing = REQUIRED - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns: {sorted(list(missing))}")

    df["type"] = df["type"].astype(str).str.lower()
    df["fixed_float"] = df["fixed_float"].astype(str).str.lower()
    df["float_share"] = pd.to_numeric(df["float_share"], errors="coerce").fillna(0.0).astype(float)
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").astype(float)
    df["rate"] = pd.to_numeric(df["rate"], errors="coerce").astype(float)
    df["duration"] = pd.to_numeric(df["duration"], errors="coerce").astype(float)

    if "deposit_beta" not in df.columns:
        df["deposit_beta"] = 0.0
    df["deposit_beta"] = pd.to_numeric(df["deposit_beta"], errors="coerce").fillna(0.0).astype(float)

    if "stability" not in df.columns:
        df["stability"] = ""
    df["stability"] = df["stability"].astype(str).str.lower()

    if "convexity" not in df.columns:
        df["convexity"] = 0.0
    df["convexity"] = pd.to_numeric(df["convexity"], errors="coerce").fillna(0.0).astype(float)

    df["category"] = df["category"].astype(str)
    df["category_up"] = df["category"].str.upper()

    return df