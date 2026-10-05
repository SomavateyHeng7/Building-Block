import { DEFAULT_LEGEND } from "@/lib/diagram/defaultLegend";
import type { BlockColorKey } from "@/lib/diagram/types";

const COLORS = new Map(DEFAULT_LEGEND.map((entry) => [entry.key, entry.color]));
/** Legend colours dark enough to need light text. */
const DARK_KEYS = new Set<BlockColorKey>(["microservice", "ai-focus", "replacement", "rest-api"]);

interface MockBlock {
  label: string;
  tech?: string;
  colorKey: BlockColorKey;
  notes?: boolean;
}

const CONTAINERS: { label: string; blocks: MockBlock[] }[] = [
  {
    label: "Channels",
    blocks: [
      { label: "Web Storefront", tech: "Next.js", colorKey: "product" },
      { label: "Mobile App", tech: "React Native", colorKey: "enhancement" },
      { label: "Partner Portal", colorKey: "new", notes: true },
    ],
  },
  {
    label: "Core Platform",
    blocks: [
      { label: "API Gateway", tech: "Kong", colorKey: "rest-api" },
      { label: "Order Service", tech: "Java", colorKey: "microservice" },
      { label: "Recommendations", tech: "Python", colorKey: "ai-focus" },
      { label: "Legacy Billing", colorKey: "replacement" },
    ],
  },
  {
    label: "External",
    blocks: [
      { label: "Payments", tech: "Stripe", colorKey: "third-party" },
      { label: "Shipping", tech: "Carrier API", colorKey: "third-party" },
    ],
  },
];

const USED_KEYS = new Set(CONTAINERS.flatMap((container) => container.blocks.map((block) => block.colorKey)));

/** A static, non-interactive picture of the editor, drawn with HTML so it stays sharp and themed. */
export default function HeroDiagram() {
  return (
    <div
      aria-label="Example L0 diagram of an e-commerce platform"
      role="img"
      className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/40"
    >
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <span className="ml-3 text-xs font-medium text-zinc-500">E-commerce Platform — L0</span>
      </div>

      <div className="bg-[radial-gradient(circle,_rgb(161_161_170/0.35)_1px,_transparent_1px)] bg-[length:16px_16px] p-4 sm:p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_1.35fr_1fr]">
          {CONTAINERS.map((container) => (
            <div
              key={container.label}
              className="rounded-lg border border-zinc-300 bg-zinc-50/90 dark:border-zinc-700 dark:bg-zinc-900/90"
            >
              <div className="rounded-t-lg bg-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                {container.label}
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                {container.blocks.map((block) => (
                  <div
                    key={block.label}
                    className={`relative rounded-md border border-black/10 px-2 py-2 text-center ${
                      DARK_KEYS.has(block.colorKey) ? "text-white" : "text-zinc-900"
                    }`}
                    style={{ backgroundColor: COLORS.get(block.colorKey) }}
                  >
                    <div className="text-[11px] font-semibold leading-tight">{block.label}</div>
                    {block.tech && <div className="mt-0.5 text-[10px] leading-tight opacity-75">{block.tech}</div>}
                    {block.notes && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-amber-950">
                        !
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          {DEFAULT_LEGEND.filter((entry) => USED_KEYS.has(entry.key)).map((entry) => (
            <span key={entry.key} className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
              <span className="h-3 w-3 rounded-sm border border-black/15" style={{ backgroundColor: entry.color }} />
              {entry.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
