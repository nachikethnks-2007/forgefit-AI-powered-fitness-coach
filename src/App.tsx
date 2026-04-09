import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import SplitBuilder from "./components/SplitBuilder.tsx";
import EnhancedWorkoutTracker from "./components/EnhancedWorkoutTracker.tsx";
import { migrateWorkoutPlanData } from "@/utils/forgefitLocalStorage";
import { runBiWeeklyWorkoutAnalysis } from '@/utils/workoutAnalysis';

const queryClient = new QueryClient();

const App = () => {

  // MIGRATION: Run data migration on app load
  useEffect(() => {
    migrateWorkoutPlanData();
  }, []);

  // AI SCHEDULER: Run bi-weekly workout analysis
  useEffect(() => {
    // Run bi-weekly workout analysis on app load (checks if due)
    runBiWeeklyWorkoutAnalysis();
    
    // Set up daily check for workout analysis
    const interval = setInterval(() => {
      runBiWeeklyWorkoutAnalysis();
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
            <Route path="/split-builder" element={<SplitBuilder />} />
            <Route path="/workout-tracker" element={<EnhancedWorkoutTracker />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;