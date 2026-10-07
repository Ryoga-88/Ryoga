import { photoCuration, localAccessAllowed } from "app/lib/photo-curation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

function failure(error) {
  return Response.json({ error: error.status ? error.message : "保存できませんでした。画像がMac内にあるか確認して、もう一度お試しください。" }, { status: error.status || 500, headers });
}

export async function GET(request) {
  if (!localAccessAllowed(request.headers)) return new Response(null, { status: 404, headers });
  try { return Response.json(await photoCuration.clientData(), { headers }); }
  catch (error) { return failure(error); }
}

export async function POST(request) {
  if (!localAccessAllowed(request.headers, { mutation: true })) return new Response(null, { status: 404, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return new Response(null, { status: 415, headers });
  try {
    const text = await request.text();
    if (text.length > 20000) return new Response(null, { status: 413, headers });
    let body;
    try { body = JSON.parse(text); } catch { return Response.json({ error: "データの形式が正しくありません。" }, { status: 400, headers }); }
    const result = await photoCuration.decide(body?.ids, body?.status);
    return Response.json({ ...result, publishedCount: result.selectedCount }, { headers });
  } catch (error) { return failure(error); }
}
