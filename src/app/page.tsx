import ReetiWorkbench from "@/components/reeti-workbench";

const productSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Reeti",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "A persistent content operator for creators who repurpose long-form work.",
  featureList: [
    "Source ingestion",
    "Cross-session creator context",
    "Campaign review",
    "Continuity evidence",
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <ReetiWorkbench />
    </>
  );
}
