import { ParkedRouteNotice } from "@/components/ParkedRouteNotice";

export default function AgentDeployPage() {
  return (
    <ParkedRouteNotice
      title="Deployment is parked for now"
      description="This phase is about making the ingestion and preview trustworthy first. Once the agent is grounded and reliable, deployment will come back."
    />
  );
}
