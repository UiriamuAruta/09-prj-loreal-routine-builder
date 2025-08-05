// functions/api/routine.js
// Cloudflare Pages Function handling /api/routine with live web search citations

export async function onRequest({ request, env }) {
  // Common CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Preflight support
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Health check
  if (request.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', path: '/api/routine' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Only POST beyond this point
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  // Parse payload
  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
  }

  // API key check
  const openaiKey = env.OPENAI_API;
  if (!openaiKey) {
    return new Response('Server error: OPENAI_API not configured', { status: 500, headers: corsHeaders });
  }

  // Build messages
  const systemPrompt = `You are a knowledgeable L'Oréal skincare and beauty advisor. Provide clear, step-by-step personalized routines and answer follow-up questions using live web search when necessary. Include citation links in your responses.`;
  const messages = [{ role: 'system', content: systemPrompt }];

  if (payload.products) {
    const list = JSON.stringify(payload.products, null, 2);
    messages.push({ role: 'user', content: `Generate a beauty routine using these products:\n${list}` });
  } else if (payload.history) {
    // Handle follow-up: perform web search on last user query
    const lastMsg = payload.history[payload.history.length - 1].content;

    if (env.BING_API_KEY) {
      try {
        const searchRes = await fetch(
          `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(lastMsg)}&count=3`,
          { headers: { 'Ocp-Apim-Subscription-Key': env.BING_API_KEY } }
        );
        const searchJson = await searchRes.json();
        const results = searchJson.webPages?.value || [];
        let searchText = 'Live Search Results:\n';
        results.forEach((r, i) => {
          searchText += `[${i+1}] ${r.name}: ${r.url}\n`;
        });
        // Add results to prompt
        messages.push({ role: 'user', content: searchText });
        messages.push({
          role: 'user',
          content: `${lastMsg}\n\nPlease answer using the above search results and cite each answer using the result numbers.`
        });
      } catch (err) {
        // Fallback if search fails
        messages.push({ role: 'user', content: lastMsg });
      }
    } else {
      // No search key: just pass the question
      messages.push({ role: 'user', content: lastMsg });
    }
  } else {
    return new Response('Bad Request: Missing products or history', { status: 400, headers: corsHeaders });
  }

  // Call OpenAI
  let aiRes;
  try {
    aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 800
      })
    });
  } catch (err) {
    return new Response(`Fetch error: ${err.message}`, { status: 502, headers: corsHeaders });
  }

  if (!aiRes.ok) {
    let msg = `HTTP ${aiRes.status}`;
    try {
      const errJson = await aiRes.json();
      msg = errJson.error?.message || msg;
    } catch {}
    return new Response(`OpenAI API error: ${msg}`, { status: 502, headers: corsHeaders });
  }

  const { choices } = await aiRes.json();
  const content = choices[0]?.message?.content || 'No content returned.';

  // Build response
  const responsePayload = payload.products
    ? { routine: content }
    : { reply: content };

  return new Response(JSON.stringify(responsePayload), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

