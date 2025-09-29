type Props = Record<string, string | number | boolean | null | undefined>;

const enabled = Boolean((import.meta as any).env?.VITE_ANALYTICS);
const provider = (import.meta as any).env?.VITE_ANALYTICS || "console";

export function pageview(path: string) {
  if (!enabled) return console.debug("[pv]", path);
  if ((window as any).plausible) (window as any).plausible("pageview", { u: path });
  else console.debug("[pv]", path, `(provider=${provider})`);
}

export function track(event: "upload" | "run" | "export", props?: Props) {
  if (!enabled) return console.debug("[ev]", event, props || {});
  if ((window as any).plausible) (window as any).plausible(event, { props });
  else console.debug("[ev]", event, props || {}, `(provider=${provider})`);
}