import { absoluteUrl } from "app/lib/site";

// Search engines and AI crawlers (GPTBot, ClaudeBot, PerplexityBot, …) are all
// welcome: being quotable is the point of the site.
export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
