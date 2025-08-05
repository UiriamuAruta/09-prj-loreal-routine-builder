// functions/api/routine.js
// Cloudflare Pages Function handling /api/routine

export async function onRequest({ request, env }) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Only POST allowed
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Parse JSON payload
  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Check API key
  const apiKey = env.OPENAI_API;
  if (!apiKey) {
    return new Response('Server error: OPENAI_API not set', {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Build messages
  const systemPrompt = `You are a knowledgeable L'Oréal skincare and beauty advisor. Help the user build personalized skincare, haircare, makeup, or fragrance routines using the products they select. Provide clear, step-by-step instructions.`;
  const messages = [{ role: 'system', content: systemPrompt }];

  if (payload.products) {
    messages.push({
      role: 'user',
      content: `Please generate a personalized beauty routine using these products:\n${JSON.stringify(payload.products, null, 2)}`
    });
  } else if (payload.history) {
    for (const msg of payload.history) {
      messages.push({ role: msg.role, content: msg.content });
    }
  } else {
    return new Response('Bad Request: missing products or history', { status: 400 });
  }

  // Call OpenAI
  const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!aiRes.ok) {
    const err = await aiRes.json().catch(() => ({}));
    const msg = err.error?.message || `HTTP ${aiRes.status}`;
    return new Response(`OpenAI API error: ${msg}`, {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  const { choices } = await aiRes.json();
  const content = choices[0]?.message?.content || 'Unable to generate response.';

  // Respond
  const responsePayload = payload.products
    ? { routine: content }
    : { reply: content };

  return new Response(JSON.stringify(responsePayload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
