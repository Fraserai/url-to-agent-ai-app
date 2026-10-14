import { ParkedRouteNotice } from "@/components/ParkedRouteNotice";

export default function LoginPage() {
  return (
    <ParkedRouteNotice
      title="Login is parked for this phase"
      description="Auth is temporarily out of the main product flow while we focus on getting URL ingestion, business extraction, and the grounded agent preview working properly."
    />
  );
}
