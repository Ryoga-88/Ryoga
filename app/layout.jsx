import "./globals.css";
import Header from "app/components/header";
import { NavigationTracker } from "app/components/back-link";
import Footer from "app/components/footer";
import JsonLd from "app/components/json-ld";
import { ThemeProvider } from "app/components/theme-provider";
import { THEME_INIT_SCRIPT } from "app/lib/theme";
import { FEED_ALTERNATES, SITE, absoluteUrl, personJsonLd } from "app/lib/site";

export const metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: `%s | ${SITE.author}` },
  description: SITE.description,
  keywords: SITE.keywords,
  authors: [{ name: SITE.author, url: absoluteUrl("/") }],
  creator: SITE.author,
  alternates: { types: FEED_ALTERNATES },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "ja_JP",
    title: SITE.title,
    description: SITE.description,
    images: [{ url: SITE.image, width: 1176, height: 1176, alt: SITE.author }],
  },
  twitter: { card: "summary", creator: SITE.twitter },
  verification: { google: "duIULWMuN87iNsRpBQM9ChtbDg1qQ-Ct15oLlqt5HV0" },
  icons: { icon: "/favicon.ico" },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1f20" },
  ],
};

const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      url: absoluteUrl("/"),
      name: SITE.name,
      description: SITE.description,
      inLanguage: "ja",
      publisher: { "@id": personJsonLd()["@id"] },
    },
    personJsonLd(),
  ],
};

export default function RootLayout({ children }) {
  return (
    // data-theme is set by the inline script before hydration.
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col bg-bg text-ink antialiased">
        <ThemeProvider>
          <NavigationTracker />
          <a href="#main" className="skip-link">
            本文へスキップ
          </a>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </ThemeProvider>
        <JsonLd data={siteJsonLd} />
      </body>
    </html>
  );
}
