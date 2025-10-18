import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { ip, endpoint, status } = await req.json()
    
    console.log(`[ESP32 Proxy] Request - IP: ${ip}, Endpoint: ${endpoint}, Status: ${status}`)
    
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

    console.log(`[ESP32 Proxy] Calling ESP32: ${url}`)

    // Make request to ESP32
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const esp32Response = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    console.log(`[ESP32 Proxy] ESP32 responded with status: ${esp32Response.status}`)

    if (!esp32Response.ok) {
      const errorText = await esp32Response.text()
      console.error(`[ESP32 Proxy] ESP32 error response: ${errorText}`)
      return new Response(
        JSON.stringify({ error: `ESP32 error: ${esp32Response.status}`, details: errorText }),
        { status: esp32Response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse ESP32 JSON response
    const esp32Data = await esp32Response.json()
    console.log(`[ESP32 Proxy] ESP32 data:`, esp32Data)

    return new Response(
      JSON.stringify(esp32Data),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('[ESP32 Proxy] Error:', error)
    console.error('[ESP32 Proxy] Error name:', error.name)
    console.error('[ESP32 Proxy] Error message:', error.message)
    
    let errorMessage = 'Failed to reach ESP32'
    let statusCode = 500
    
    if (error.name === 'AbortError') {
      errorMessage = 'ESP32 connection timeout - device may be offline'
      statusCode = 504
    } else if (error.message?.includes('JSON')) {
      errorMessage = 'ESP32 returned invalid JSON - check Arduino code'
      statusCode = 502
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage, details: error.message }),
      { 
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
