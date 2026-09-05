import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

// SECURITY: the original project contained a bootstrap function with a hard-coded
// administrator password. That is intentionally disabled. Create/restore owner
// accounts from the Supabase Dashboard or through a separately protected internal
// process; never expose a predictable admin credential through a public function.
Deno.serve(() => new Response(JSON.stringify({
  error: 'This bootstrap endpoint is disabled for security. Manage owner accounts through Supabase Authentication.'
}), {
  status: 410,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  },
}));
