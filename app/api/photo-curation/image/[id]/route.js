import { photoCuration, localAccessAllowed } from "app/lib/photo-curation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (!localAccessAllowed(request.headers)) return new Response(null, { status: 404, headers });
  try {
    const { id } = await params;
    const size = new URL(request.url).searchParams.get("size") || "thumb";
    const buffer = await photoCuration.preview(id, size);
    return new Response(new Uint8Array(buffer), { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch (error) {
    return Response.json({ error: "画像を表示できませんでした。" }, { status: error.status || 500, headers });
  }
}
