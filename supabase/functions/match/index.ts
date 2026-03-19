import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type MatchSession = {
  room_id: string
  user_one_email: string
  user_two_email: string
  offerer_email: string
  answerer_email: string
}

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
}

const buildMatchedResponse = (email: string, session: MatchSession) =>
  JSON.stringify({
    status: 'matched',
    roomId: session.room_id,
    peer: session.user_one_email === email ? session.user_two_email : session.user_one_email,
    role: session.offerer_email === email ? 'offerer' : 'answerer',
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    const domain = email.split('@')[1]
    if (!domain) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const staleThreshold = new Date(Date.now() - 120000).toISOString()

    await supabase.from('match_queue').delete().lt('created_at', staleThreshold)
    await supabase.from('match_sessions').delete().lt('created_at', staleThreshold)

    const { data: existingSession, error: existingSessionError } = await supabase
      .from('match_sessions')
      .select('room_id, user_one_email, user_two_email, offerer_email, answerer_email')
      .or(`user_one_email.eq.${email},user_two_email.eq.${email}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingSessionError) {
      return new Response(JSON.stringify({ error: existingSessionError.message }), {
        status: 500,
        headers: jsonHeaders,
      })
    }

    if (existingSession) {
      await supabase.from('match_queue').delete().eq('email', email)

      return new Response(buildMatchedResponse(email, existingSession), {
        headers: jsonHeaders,
      })
    }

    const { data: peers, error: peersError } = await supabase
      .from('match_queue')
      .select('*')
      .neq('email', email)
      .order('created_at', { ascending: true })
      .limit(1)

    if (peersError) {
      return new Response(JSON.stringify({ error: peersError.message }), {
        status: 500,
        headers: jsonHeaders,
      })
    }

    if (peers && peers.length > 0) {
      const peer = peers[0]
      const roomId = crypto.randomUUID()

      const { data: session, error: sessionError } = await supabase
        .from('match_sessions')
        .insert({
          room_id: roomId,
          user_one_email: peer.email,
          user_two_email: email,
          offerer_email: email,
          answerer_email: peer.email,
        })
        .select('room_id, user_one_email, user_two_email, offerer_email, answerer_email')
        .single()

      if (sessionError) {
        return new Response(JSON.stringify({ error: sessionError.message }), {
          status: 500,
          headers: jsonHeaders,
        })
      }

      await supabase.from('match_queue').delete().in('email', [peer.email, email])

      return new Response(buildMatchedResponse(email, session), {
        headers: jsonHeaders,
      })
    }

    const { data: existingQueueEntry, error: existingQueueError } = await supabase
      .from('match_queue')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingQueueError) {
      return new Response(JSON.stringify({ error: existingQueueError.message }), {
        status: 500,
        headers: jsonHeaders,
      })
    }

    if (existingQueueEntry) {
      return new Response(
        JSON.stringify({
          status: 'waiting',
          queueId: existingQueueEntry.id,
        }),
        { headers: jsonHeaders }
      )
    }

    const { data: entry, error: insertError } = await supabase
      .from('match_queue')
      .insert({ email, domain })
      .select('id')
      .single()

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: jsonHeaders,
      })
    }

    return new Response(
      JSON.stringify({
        status: 'waiting',
        queueId: entry.id,
      }),
      { headers: jsonHeaders }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: jsonHeaders,
    })
  }
})