import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => {
  // ✅ ONLY for controlling app
  const [apiKey] = useState(
    () => localStorage.getItem("groqApiKey") || ""
  );

  // ✅ ONLY for typing input
  const [tempKey, setTempKey] = useState("");

  // 🔥 API KEY SCREEN
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
          value={tempKey}
          placeholder="Paste your API key..."
          onChange={(e) => setTempKey(e.target.value)}
          style={{
            padding: "10px",
            margin: "10px",
            width: "300px",
            borderRadius: "8px",
            border: "none",
            outline: "none"
          }}
        />

        <button
          onClick={() => {
            if (!tempKey.trim()) return alert("Enter API key");

            localStorage.setItem("groqApiKey", tempKey);
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

  // ✅ MAIN APP
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