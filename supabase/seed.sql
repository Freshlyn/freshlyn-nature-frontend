-- Local-only secrets consumed by fn_finalize_due_deletions' net.http_post call.
-- api.supabase.internal is the fixed Docker-internal hostname for the local
-- Kong gateway (reachable from the Postgres container, unlike 127.0.0.1:54321).
select vault.create_secret('http://api.supabase.internal:8000', 'project_url');
select vault.create_secret('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU', 'service_role_key');
