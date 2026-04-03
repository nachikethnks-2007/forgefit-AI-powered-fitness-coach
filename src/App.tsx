import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => {
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    const key = localStorage.getItem("groqApiKey");
    if (key) setApiKey(key);
  }, []);

  // 🔥 API KEY SCREEN (shown first if no key)
  if (!apiKey) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#000",
        color: "#fff",
        flexDirection: "column"
      }}>
        <h2>Enter your Groq API Key</h2>
        <input
          type="text"
          value={apiKey}
          placeholder="Paste your API key..."
          onChange={(e) => setApiKey(e.target.value)}
          style={{
            padding: "10px",
            margin: "10px",
            width: "300px",
            borderRadius: "8px",
            border: "none"
          }}
        />
        <button
          onClick={() => {
            localStorage.setItem("groqApiKey", apiKey);
            window.location.reload();
          }}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            background: "#00f5ff",
            color: "#000",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          Save & Continue
        </button>
      </div>
    );
  }

  // ✅ ORIGINAL APP (unchanged)
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;