def print_console_report(eve_res: dict, nii_res: dict, liq_res: dict):
    print(f"\n=== Interest Rate Shock: {eve_res['shock_bps']} bps ===")
    print(f"EVE change: {eve_res['delta_eve']:.2f}  ({eve_res['delta_eve_pct_equity']*100:.1f}% of equity)")
    print(f"NII 12m change: {nii_res['delta_nii']:.2f}")
    print(f"HQLA: {liq_res['hqla']:.2f}  | Stressed outflows: {liq_res['stressed_outflows']:.2f}  | Coverage: {liq_res['coverage_ratio']:.2f}x")