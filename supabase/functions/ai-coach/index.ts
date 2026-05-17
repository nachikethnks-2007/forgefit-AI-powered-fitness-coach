// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"
import Groq from "npm:groq-sdk"
console.log("FUNCTION STARTED")

const MODEL = "llama-3.3-70b-versatile"

// Fitness-focused system prompt for ForgeFit AI Coach
const SYSTEM_PROMPT = `You are ForgeFit AI Coach, a professional fitness and nutrition coach. Your role is to help users achieve their fitness goals through personalized guidance.

Your expertise includes:
- Workout planning and exercise form
- Nutrition guidance and meal planning
- Progressive overload and training principles
- Recovery and injury prevention
- Motivation and habit building

Guidelines:
- Be encouraging but realistic
- Prioritize safety above all else
- Ask clarifying questions when needed
- Provide specific, actionable advice
- Consider individual fitness levels and limitations
- When suggesting exercises, include form tips
- For nutrition, focus on sustainable habits over strict diets
- Always recommend consulting healthcare professionals for medical concerns

Keep responses concise and practical. Focus on helping users take immediate action toward their goals.`

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  }

  try {
    // Get API key from Supabase secrets
    const groqApiKey = Deno.env.get("GROQ_API_KEY")

    if (!groqApiKey) {
      throw new Error("GROQ_API_KEY not configured")
    }

    // Initialize Groq client
    const groq = new Groq({
      apiKey: groqApiKey,
    })

    // Parse request body
    const body = await req.json()
    const { message } = body

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid request: 'message' field required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      )
    }

    // Call Groq API using SDK
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    const aiResponse =
      completion.choices?.[0]?.message?.content ||
      "I apologize, but I couldn't generate a response. Please try again."

    // Return response
    return new Response(
      JSON.stringify({ response: aiResponse }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  } catch (error) {
    console.error("AI Coach error:", error)

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    return new Response(
      JSON.stringify({
        error: "Failed to process request",
        details: errorMessage,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  }
})