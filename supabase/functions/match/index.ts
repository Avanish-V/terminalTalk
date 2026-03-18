import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const domain = email.split('@')[1]
    if (!domain) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Clean up stale entries (older than 2 minutes)
    await supabase
      .from('match_queue')
      .delete()
      .lt('created_at', new Date(Date.now() - 120000).toISOString())

    // Remove any existing entries for this email
    await supabase.from('match_queue').delete().eq('email', email)

    // Try to find a waiting peer (not from the same domain to keep it interesting)
    const { data: peers } = await supabase
      .from('match_queue')
      .select('*')
      .neq('email', email)
      .order('created_at', { ascending: true })
      .limit(1)

    if (peers && peers.length > 0) {
      const peer = peers[0]
      // Remove peer from queue
      await supabase.from('match_queue').delete().eq('id', peer.id)

      // Generate a room ID for the pair
      const roomId = crypto.randomUUID()

      return new Response(
        JSON.stringify({
          status: 'matched',
          roomId,
          peer: peer.email,
          role: 'offerer', // This user creates the WebRTC offer
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // No peer found, add to queue
    const { data: entry, error } = await supabase
      .from('match_queue')
      .insert({ email, domain })
      .select()
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        status: 'waiting',
        queueId: entry.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
