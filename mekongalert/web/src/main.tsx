import { ConfigProvider, theme } from "antd";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "./lib/i18n";
import "./styles/animations.css";
import "./styles/theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: "#2dd4bf",
            colorLink: "#2dd4bf",
            colorInfo: "#2dd4bf",
            colorBgBase: "#0a0a0a",
            colorBgContainer: "#141414",
            colorBgElevated: "#1c1c1c",
            colorBgLayout: "#0a0a0a",
            borderRadius: 14,
            borderRadiusLG: 20,
            fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif",
          },
        }}
      >
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </StrictMode>,
);
