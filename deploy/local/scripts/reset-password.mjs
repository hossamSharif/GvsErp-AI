/**
 * Set a user's password without email (owner locked out, etc.).
 * Runs INSIDE the api container, which has Node, the service key and access
 * to the gateway. The Windows script pipes this file in:
 *
 *   docker compose exec -T api node --input-type=module - <email> <new password> < scripts/reset-password.mjs
 */
const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('usage: node - <email> <new password>');
  process.exit(2);
}
if (password.length < 8) {
  console.error('The new password must be at least 8 characters.');
  process.exit(2);
}

const base = `${process.env.SUPABASE_URL}/auth/v1`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };

let user = null;
for (let page = 1; !user; page++) {
  const r = await fetch(`${base}/admin/users?page=${page}&per_page=200`, { headers });
  if (!r.ok) throw new Error(`Listing users failed: HTTP ${r.status}`);
  const { users = [] } = await r.json();
  user = users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
  if (users.length < 200) break;
}
if (!user) {
  console.error(`No user with email ${email}`);
  process.exit(1);
}

const r = await fetch(`${base}/admin/users/${user.id}`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({ password }),
});
if (!r.ok) {
  console.error(`Password change failed: HTTP ${r.status} ${await r.text()}`);
  process.exit(1);
}
console.log(`Password updated for ${email}.`);
