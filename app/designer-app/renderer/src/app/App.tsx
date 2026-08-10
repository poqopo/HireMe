import DesignerWorkspacePage from "@/pages/DesignerWorkspacePage";
import { WorkspaceErrorBoundary } from "@/components/WorkspaceErrorBoundary";

export function App() {
  return (
    <WorkspaceErrorBoundary>
      <DesignerWorkspacePage />
    </WorkspaceErrorBoundary>
  );
}
