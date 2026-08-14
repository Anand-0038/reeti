# SEO and discoverability notes

Reeti is currently a local-first hackathon artifact, so `robots.txt` intentionally disallows
crawling. Local metadata resolves relative social assets against `http://localhost:3000`; no
public sitemap URL is emitted by default. Before any public launch:

- set `NEXT_PUBLIC_SITE_URL` to the verified deployment URL;
- change `robots` to allow only the intended public landing route;
- update the sitemap to the actual canonical URL;
- provide a real social preview asset and check its dimensions;
- keep private workspace routes and source content out of indexing;
- do not publish unsupported creator, traction, or performance claims.

The current app includes semantic headings, JSON-LD SoftwareApplication metadata, a manifest,
icon, Open Graph card, and a mobile viewport, but these are local implementation assets rather
than proof of a public site.
