import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { ip, endpoint, status } = await req.json()
    
    if (!ip) {
      return new Response(
        JSON.stringify({ error: 'IP address required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate IP format
    const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
    if (!ipRegex.test(ip)) {
      return new Response(
        JSON.stringify({ error: 'Invalid IP address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build URL based on endpoint
    let url = `http://${ip}`
    if (endpoint === 'status') {
      url += '/status'
    } else if (endpoint === 'control' && status) {
      url += `/control?status=${status}`
    } else {
      url += '/status' // Default to status
    }

    console.log(`Proxying request to ESP32: ${url}`)

    // Make request to ESP32
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    const data = await response.text()
    
    console.log(`ESP32 response: ${response.status} - ${data}`)

    return new Response(
      data,
      { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('ESP32 proxy error:', error)
    
    let errorMessage = 'Failed to reach ESP32'
    if (error.name === 'AbortError') {
      errorMessage = 'ESP32 connection timeout'
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage, details: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
