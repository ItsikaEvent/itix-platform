import { useEffect } from "react";

interface SeoOptions {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  schema?: Record<string, unknown>;
}

export function usePageSeo({ title, description, image, url, schema }: SeoOptions) {
  useEffect(() => {
    // 1. Dynamic Title
    const formattedTitle = title.includes("ITIX") ? title : `${title} | ITIX Billetterie`;
    document.title = formattedTitle;

    // 2. Helper to set or update meta tag
    const setMeta = (attrName: "name" | "property", attrVal: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[${attrName}="${attrVal}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
      setMeta("name", "twitter:description", description);
    }

    setMeta("property", "og:title", formattedTitle);
    setMeta("name", "twitter:title", formattedTitle);

    if (url) {
      setMeta("property", "og:url", url);
      let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }
      canonical.href = url;
    }

    if (image) {
      setMeta("property", "og:image", image);
      setMeta("name", "twitter:image", image);
    }

    // 3. Schema.org JSON-LD injection
    let scriptEl = document.getElementById("itix-page-schema") as HTMLScriptElement | null;
    if (schema) {
      if (!scriptEl) {
        scriptEl = document.createElement("script");
        scriptEl.id = "itix-page-schema";
        scriptEl.type = "application/ld+json";
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(schema);
    } else if (scriptEl) {
      scriptEl.remove();
    }

    return () => {
      // Optional cleanup on unmount
      const s = document.getElementById("itix-page-schema");
      if (s) s.remove();
    };
  }, [title, description, image, url, schema]);
}
