const SUPABASE_URL = 'https://fbjervpgxnbyntylabfr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiamVydnBneG5ieW50eWxhYmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NzU1ODksImV4cCI6MjA5MjA1MTU4OX0.cMGLe14EDNivZHREWvmE7QMHjb4V_STx0Mfbx7AT4dg';

const sb = {
  url: SUPABASE_URL,
  key: SUPABASE_ANON_KEY,
  headers(extra = {}) {
    return {
      'Content-Type': 'application/json',
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      ...extra
    };
  },
  async getAll(table, query = '') {
    const res = await fetch(`${this.url}/rest/v1/${table}?${query}`, {
      headers: this.headers({ 'Prefer': 'return=representation' })
    });
    if (!res.ok) throw new Error(`GET ${table} failed: ${res.status}`);
    return res.json();
  },
  async insert(table, data) {
    const res = await fetch(`${this.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: this.headers({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`INSERT ${table} failed: ${err}`); }
    return res.json();
  },
  async update(table, id, data) {
    const res = await fetch(`${this.url}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: this.headers({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`UPDATE ${table} failed: ${err}`); }
    return res.json();
  },
  async upsert(table, data, onConflict = 'id') {
    const res = await fetch(`${this.url}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: this.headers({ 'Prefer': 'return=representation,resolution=merge-duplicates' }),
      body: JSON.stringify(data)
    });
    if (!res.ok) { const err = await res.text(); throw new Error(`UPSERT ${table} failed: ${err}`); }
    return res.json();
  },
  async delete(table, id) {
    const res = await fetch(`${this.url}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: this.headers()
    });
    if (!res.ok) throw new Error(`DELETE ${table} failed: ${res.status}`);
    return true;
  }
};