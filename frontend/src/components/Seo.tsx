import { useEffect } from "react";

export const DEFAULT_SEO_TITLE = "Padelo | Padel Tournament Scoreboard";
export const DEFAULT_SEO_DESCRIPTION =
  "Create Americano and Mexicano padel tournaments, share room codes, track live scores, and view leaderboards from any device.";

const SITE_NAME = "Padelo";
const FEATURE_LIST = [
  "Americano and Mexicano padel tournament setup",
  "Shareable room codes",
  "Live tournament scoreboard",
  "Round and match result tracking",
  "Final leaderboard and results sharing",
];

type StructuredDataType = "webApplication" | "webPage";

type SeoProps = {
  title: string;
  description: string;
  path: string;
  robots?: string;
  structuredData?: StructuredDataType | null;
};

export function Seo({
  title,
  description,
  path,
  robots = "index,follow",
  structuredData = "webPage",
}: SeoProps) {
  useEffect(() => {
    const canonicalUrl = getCanonicalUrl(path);

    document.title = title;
    setMeta("name", "description", description);
    setMeta("name", "robots", robots);
    setMeta("name", "application-name", SITE_NAME);
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("name", "twitter:card", "summary");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setCanonical(canonicalUrl);

    if (structuredData) {
      setStructuredData(buildStructuredData(structuredData, title, description, canonicalUrl));
    } else {
      removeStructuredData();
    }
  }, [description, path, robots, structuredData, title]);

  return null;
}

function getCanonicalUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const configuredBaseUrl = import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  const baseUrl = configuredBaseUrl || window.location.origin;

  return `${baseUrl}${normalizedPath}`;
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.content = content;
}

function setCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }

  element.href = url;
}

function setStructuredData(data: Record<string, unknown>) {
  let element = document.getElementById("seo-structured-data") as HTMLScriptElement | null;

  if (!element) {
    element = document.createElement("script");
    element.id = "seo-structured-data";
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(data);
}

function removeStructuredData() {
  document.getElementById("seo-structured-data")?.remove();
}

function buildStructuredData(
  type: StructuredDataType,
  title: string,
  description: string,
  canonicalUrl: string,
) {
  if (type === "webApplication") {
    return {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      url: canonicalUrl,
      description,
      applicationCategory: "SportsApplication",
      operatingSystem: "Any",
      featureList: FEATURE_LIST,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    url: canonicalUrl,
    description,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: new URL(canonicalUrl).origin,
    },
  };
}
