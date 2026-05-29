import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight, errorResponse } from "../_shared/cors.ts";

// Deletes ALL data for the authenticated user (GDPR Art. 17 - Right to Erasure)
// Order matters: delete child records first to respect foreign key constraints

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Extract user JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Authorization required', 401, corsHeaders);
    }

    // Create a client with the user's JWT to verify identity
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return errorResponse('Invalid authentication', 401, corsHeaders);
    }

    const userId = user.id;
    console.log(`[delete-user-data] Starting deletion for user ${userId}`);

    // Use service role for actual deletion (needs elevated permissions)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Delete all personal data + anonymize retained financial records in one
    // transactional RPC. This replaces the old per-table delete list, which
    // silently missed answers, saved_jobs, cover_letters, and several more.
    const { error: rpcError } = await supabase.rpc('delete_user_personal_data', {
      p_user_id: userId,
    });
    if (rpcError) {
      console.error(`[delete-user-data] RPC failed for ${userId}:`, rpcError);
      // Abort BEFORE deleting the auth user so the user can retry.
      // The RPC is idempotent, so a retry is safe.
      return errorResponse('Failed to delete account data. Please contact support.', 500, corsHeaders);
    }

    const errors: string[] = [];

    // Delete resume files from storage (best-effort; not covered by the RPC).
    try {
      const { data: files } = await supabase.storage.from('resumes').list(userId);
      if (files && files.length > 0) {
        await supabase.storage.from('resumes').remove(files.map((f) => `${userId}/${f.name}`));
      }
    } catch (storageError) {
      errors.push(`storage: ${String(storageError)}`);
    }

    // Delete the auth user last — also clears auth-schema sessions/identities.
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) errors.push(`auth: ${authDeleteError.message}`);

    if (errors.length > 0) {
      console.error(`[delete-user-data] Partial deletion for ${userId}:`, errors);
      // Still return success - partial deletion is better than no deletion
      // Log the errors for admin follow-up
      return new Response(JSON.stringify({
        success: true,
        message: 'Account deleted. Some data may require manual cleanup.',
        partial_errors: errors.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[delete-user-data] Complete deletion for user ${userId}`);
    return new Response(JSON.stringify({
      success: true,
      message: 'All account data has been permanently deleted.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[delete-user-data] Error:', error);
    return errorResponse('An error occurred while deleting your account. Please contact support.', 500, corsHeaders);
  }
});
