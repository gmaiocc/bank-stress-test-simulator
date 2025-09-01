import pandas as pd

def load_balance_sheet(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    required = {"type","name","amount","rate","duration","category","fixed_float","float_share","repricing_bucket"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns: {missing}")

    # Normalise
    df["type"] = df["type"].str.lower()
    df["fixed_float"] = df["fixed_float"].str.lower()
    df["float_share"] = df["float_share"].fillna(0.0).astype(float)
    df["amount"] = df["amount"].astype(float)
    df["rate"] = df["rate"].astype(float)
    df["duration"] = df["duration"].astype(float)
    df["deposit_beta"] = df.get("deposit_beta", 0.0).fillna(0.0).astype(float)
    df["category"] = df["category"].str.upper()
    return df