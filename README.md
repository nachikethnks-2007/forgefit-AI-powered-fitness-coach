# ForgeFit AI — AI-Powered Fitness Coach

ForgeFit AI is a full-stack AI-powered fitness coaching platform built for fitness enthusiastics . The application combines workout tracking, gamified consistency systems, and intelligent AI coaching to help users build sustainable fitness habits.

## 🚀 Features

### 🤖 AI Fitness Coach

* Personalized fitness guidance
* Adaptive responses based on user goals
* Workout and nutrition suggestions
* Progressive improvement recommendations
* Conversational coaching experience

### 📈 Progressive Overload Analysis

* Analyzes workout progression over time
* Detects strength improvements and stagnation
* Suggests overload strategies
* Provides intelligent training recommendations

### 🏆 Consistency Rank System

* Gamified progression system
* Consistency tracking
* Streak monitoring
* Rank-based motivation system
* User engagement enhancement

### 🏋️ Workout Tracking

* Log workouts and exercises
* Track sets and reps
* Monitor workout history
* Daily fitness activity tracking

### 🎨 Modern UI/UX

* Clean responsive interface
* Mobile-friendly design
* Smooth user experience
* Dashboard-driven workflow

---

# 🧠 Architecture

## Frontend

* React
* TypeScript
* Vite
* Zustand
* Tailwind CSS

## Backend

* Supabase Edge Functions
* Serverless architecture
* Secure backend AI routing

## AI Infrastructure

* Groq API
* Llama 3.3 70B Versatile
* Secure API key handling

## Deployment

* Frontend: Vercel
* Backend: Supabase

---

# 🔐 Secure AI Architecture

Instead of exposing AI API keys in the frontend, ForgeFit routes all AI requests through a secure backend.

Frontend → Supabase Edge Function → Groq AI → Frontend

This ensures:

  
* security 
* Better scalability
* Centralized AI logic
* Production-style architecture

#

---

# 📌 Future Improvements

* Advanced nutrition tracking
* AI-generated meal planning
* Smart macro calculations
* Social/community features
* Wearable integration
* AI workout generation
* Real-time analytics