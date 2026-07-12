import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authenticated user from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ code: 401, message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ code: 401, message: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.email)

    // Query for unread message receipts for this user
    // Unread = message_receipts where user_id = current_user AND read_at IS NULL
    const { data: unreadReceipts, error: receiptsError } = await supabaseAdmin
      .from('message_receipts')
      .select('id, message_id, user_id, read_at')
      .eq('user_id', user.id)
      .is('read_at', null)

    if (receiptsError) {
      console.error('Error fetching unread receipts:', receiptsError)
      return new Response(
        JSON.stringify({ code: 500, message: 'Failed to fetch unread messages', error: receiptsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const unreadCount = unreadReceipts?.length || 0

    // If no unread messages, return early
    if (unreadCount === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            unread_count: 0,
            has_unread: false,
            conversations_with_unread: []
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get message details to find conversation_ids
    const messageIds = unreadReceipts.map(r => r.message_id)
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('id, conversation_id')
      .in('id', messageIds)

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return new Response(
        JSON.stringify({ code: 500, message: 'Failed to fetch message details', error: messagesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group by conversation to get unread count per conversation
    const conversationCounts: Record<string, number> = {}
    if (messages) {
      for (const message of messages) {
        if (message.conversation_id) {
          conversationCounts[message.conversation_id] = (conversationCounts[message.conversation_id] || 0) + 1
        }
      }
    }

    // Get conversation details for conversations with unread messages
    const conversationIds = Object.keys(conversationCounts)
    let conversations: any[] = []
    
    if (conversationIds.length > 0) {
      const { data: conversationsData, error: conversationsError } = await supabaseAdmin
        .from('conversations')
        .select('id, work_order_id, last_message_at, last_message_preview')
        .in('id', conversationIds)

      if (!conversationsError && conversationsData) {
        conversations = conversationsData.map(conv => ({
          id: conv.id,
          work_order_id: conv.work_order_id,
          unread_count: conversationCounts[conv.id] || 0,
          last_message_at: conv.last_message_at,
          last_message_preview: conv.last_message_preview
        }))
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          unread_count: unreadCount,
          conversations_with_unread: conversations,
          has_unread: unreadCount > 0
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ code: 500, message: 'Internal server error', error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

