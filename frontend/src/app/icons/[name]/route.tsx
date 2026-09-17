import { brandIcon } from "@/lib/brand-icon";

export const dynamic = "force-static";

const SIZES: Record<string, { side: number; maskable?: boolean }> = {
  "icon-192.png": { side: 192 },
  "icon-512.png": { side: 512 },
  "icon-512-maskable.png": { side: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((name) => ({ name }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const spec = SIZES[name];
  if (!spec) return new Response("Not found", { status: 404 });
  return brandIcon(spec.side, { maskable: spec.maskable });
}
