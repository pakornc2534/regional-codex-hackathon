import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./styles.css";
import "./shop.css";
const cache = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 1500 } },
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={cache}>
    <App />
  </QueryClientProvider>,
);
