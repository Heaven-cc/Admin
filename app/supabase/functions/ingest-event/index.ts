Deno.serve(() => new Response(JSON.stringify({ error: "DISABLED_PENDING_APPROVED_CONTRACT" }), { status: 423, headers: { "Content-Type": "application/json" } }));
