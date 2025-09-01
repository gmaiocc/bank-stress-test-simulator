from src.loader import load_balance_sheet
from src.scenarios import PARALLEL_UP_200, PARALLEL_DOWN_200
from src.eve import eve_change
from src.nii import project_nii_12m
from src.liquidity import simple_liquidity_stress
from src.reporting import print_console_report

def run_once(csv_path: str, shock_bps: int):
    df = load_balance_sheet(csv_path)
    eve_res = eve_change(df, shock_bps)
    nii_res = project_nii_12m(df, shock_bps)
    liq_res = simple_liquidity_stress(df, deposit_runoff=0.15)
    print_console_report(eve_res, nii_res, liq_res)

if __name__ == "__main__":
    csv = "data/inputs_example.csv"
    print("Running +200 bps...")
    run_once(csv, PARALLEL_UP_200.parallel_bps)
    print("\nRunning -200 bps...")
    run_once(csv, PARALLEL_DOWN_200.parallel_bps)