import { ParkedRouteNotice } from "@/components/ParkedRouteNotice";

export default function PricingPage() {
  return (
    <ParkedRouteNotice
      title="Pricing is parked for this build"
      description="This phase is focused on making URL ingestion and the grounded agent preview work properly. Pricing will come back after the core product is trustworthy."
    />
  );
}
