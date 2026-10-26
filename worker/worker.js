// 부캉이 탈출작전 랭킹 중계 서버 (Cloudflare Worker)
// 게임이 보낸 점수를 검사한 뒤 GitHub 레포의 scores.json에 기록합니다.
// GitHub 토큰은 이 서버의 비밀 변수(GH_TOKEN)에만 두고, 게임 페이지에는 넣지 않습니다.

const KEEP = 100;

export default {
  async fetch(req, env) {
    const allowed = (env.ALLOWED_ORIGINS || 'https://lloydknam.github.io').split(',').map((s) => s.trim());
    const origin = req.headers.get('Origin') || '';
    const okOrigin = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);
    try {
      if (req.method === 'GET' && url.pathname === '/scores') {
        const { rows } = await readFile(env);
        return json(rows.slice(0, 10), 200, cors);
      }
      if (req.method === 'POST' && url.pathname === '/score') {
        if (!okOrigin) return json({ error: 'origin' }, 403, cors);
        let body;
        try { body = await req.json(); } catch { return json({ error: 'json' }, 400, cors); }
        const rec = validate(body);
        if (!rec) return json({ error: 'invalid' }, 400, cors);
        for (let attempt = 0; attempt < 3; attempt++) {
          const { rows, sha } = await readFile(env);
          rows.push(rec);
          rows.sort((a, b) => b.score - a.score || a.at - b.at);
          const res = await writeFile(env, rows.slice(0, KEEP), sha, rec.name);
          if (res.ok) return json({ ok: true, id: rec.id }, 200, cors);
          if (res.status !== 409 && res.status !== 422) break;
        }
        return json({ error: 'write' }, 502, cors);
      }
    } catch (e) {
      return json({ error: 'server' }, 500, cors);
    }
    return json({ error: 'not found' }, 404, cors);
  },
};

function validate(b) {
  if (!b || typeof b !== 'object') return null;
  const name = String(b.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 8);
  const score = Number(b.score), time = Number(b.time), hearts = Number(b.hearts), won = b.won === true;
  if (!name) return null;
  if (![score, time, hearts].every(Number.isFinite)) return null;
  if (!Number.isInteger(score) || score < 0 || score > 12000) return null;
  if (time < 0 || time > 60.5 || hearts < 0 || hearts > 200) return null;
  // 게임 규칙의 최대 점수보다 높으면 거절: 시간*100 + 하트*25 + 탈출 보너스(최대 3500)
  if (score > Math.round(time * 100) + Math.floor(hearts) * 25 + (won ? 3500 : 0)) return null;
  return { id: crypto.randomUUID(), name, score, time: Math.round(time * 10) / 10, hearts: Math.floor(hearts), won, at: Date.now() };
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function gh(env, extra) {
  return {
    Authorization: 'Bearer ' + env.GH_TOKEN,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'bukang-escape-worker',
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  };
}

async function readFile(env) {
  const r = await fetch(`https://api.github.com/repos/${env.REPO}/contents/${env.FILE}`, { headers: gh(env) });
  if (r.status === 404) return { rows: [], sha: undefined };
  if (!r.ok) throw new Error('read ' + r.status);
  const j = await r.json();
  const bin = atob(j.content.replace(/\n/g, ''));
  const text = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  let rows = [];
  try { rows = JSON.parse(text); } catch {}
  return { rows: Array.isArray(rows) ? rows : [], sha: j.sha };
}

async function writeFile(env, rows, sha, name) {
  const bytes = new TextEncoder().encode(JSON.stringify(rows, null, 1) + '\n');
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const payload = { message: `랭킹 등록: ${name}`, content: btoa(bin) };
  if (sha) payload.sha = sha;
  return fetch(`https://api.github.com/repos/${env.REPO}/contents/${env.FILE}`, {
    method: 'PUT',
    headers: gh(env, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
}
