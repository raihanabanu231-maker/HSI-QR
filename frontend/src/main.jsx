import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./App.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", background: "#fef2f2", color: "#991b1b", fontFamily: "sans-serif" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "bold" }}>Application Error Detected:</h2>
          <pre style={{ background: "#fee2e2", padding: "16px", borderRadius: "8px", overflow: "auto" }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ fontSize: "12px", color: "#64748b", overflow: "auto" }}>
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Global window error catcher
window.addEventListener("error", (event) => {
  const root = document.getElementById("root");
  if (root && (!root.innerHTML || root.innerHTML.trim() === "")) {
    root.innerHTML = `<div style="padding:40px;background:#fef2f2;color:#991b1b;font-family:sans-serif;">
      <h2>Global Script Error:</h2>
      <pre>${event.message} at ${event.filename}:${event.lineno}:${event.colno}</pre>
      <pre>${event.error?.stack || ""}</pre>
    </div>`;
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
