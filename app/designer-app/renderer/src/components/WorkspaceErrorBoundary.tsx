import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class WorkspaceErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Designer workspace render failed", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main style={{ display: "grid", minHeight: "100vh", placeItems: "center", padding: 32, fontFamily: "system-ui" }}>
          <section style={{ maxWidth: 480, textAlign: "center" }}>
            <h1>작업공간을 표시하지 못했어요</h1>
            <p>로컬 작업은 그대로 보존되어 있습니다. HireMe를 다시 열어 주세요.</p>
            <button type="button" onClick={() => window.location.reload()}>다시 불러오기</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
