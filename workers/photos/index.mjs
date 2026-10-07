// Keep legacy trial URLs and versioned full/thumbnail URLs within the photo prefix.
const PHOTO_PATH = /^\/photos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:(?:-thumb)?\.webp|\/[0-9a-f]{64}\/(?:full|thumb)\.webp)$/i;

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    const pathname = new URL(request.url).pathname;
    if (!PHOTO_PATH.test(pathname)) return new Response(null, { status: 404 });
    const key = pathname.slice(1);
    const object = request.method === "HEAD" ? await env.PHOTOS.head(key) : await env.PHOTOS.get(key);
    if (object === null) return new Response(null, { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", "image/webp");
    headers.set("ETag", object.httpEtag);
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(request.method === "HEAD" ? null : object.body, { status: 200, headers });
  },
};
