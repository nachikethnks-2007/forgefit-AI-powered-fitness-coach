import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { migrateWorkoutPlanData } from "@/utils/forgefitLocalStorage";
import { runScheduledAIAnalysis } from "@/utils/proactiveAI";

const queryClient = new QueryClient();

const App = () => {

  // MIGRATION: Run data migration on app load
  useEffect(() => {
    migrateWorkoutPlanData();
  }, []);

  // AI SCHEDULER: Run scheduled analyses
  useEffect(() => {
    // Run scheduled AI analysis on app load (checks if due)
    runScheduledAIAnalysis();
    
    // Set up daily check for scheduled analyses
    const interval = setInterval(() => {
      runScheduledAIAnalysis();
    }, 60 * 60 * 1000); // Check every hour

    return () => clearInterval(interval);
  }, []);

  // MAIN APP
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