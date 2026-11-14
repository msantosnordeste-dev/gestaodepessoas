/* Ponte do Painel das Lojas com o Supabase: login, banco em tempo real e arquivos.
   Substitui os recursos do claude.ai (window.claude.use) para o painel rodar como site próprio. */
(function () {
  const CFG = window.GP_CONFIG || {};
  const DOMINIO = 'usuarios.gestaodepessoas.app';
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'painel-lojas-auth' },
    realtime: { params: { eventsPerSecond: 20 } }
  });
  const PAINEL = window.PAINEL = { sb, eu: null };

  /* ---------- login ---------- */
  function telaLogin(msg) {
    if (!document.body) { document.addEventListener('DOMContentLoaded', () => telaLogin(msg)); return; }
    const d = document.createElement('div');
    d.id = 'pLogin';
    d.innerHTML = `<div class="pl-card"><div class="pl-logo">B</div><h1>Painel das Lojas</h1><p class="pl-sub">Brasileiríssima</p>
      <form id="plForm" autocomplete="on"><label>Usuário<input id="plUser" autocomplete="username" autocapitalize="off" spellcheck="false" required></label>
      <label>Senha<input id="plSenha" type="password" autocomplete="current-password" required></label>
      <p id="plMsg" class="pl-msg">${msg || ''}</p><button type="submit" id="plBtn">Entrar</button></form>
      <p class="pl-ajuda">Esqueceu a senha? Fale com o RH.</p></div>`;
    document.body.appendChild(d);
    document.getElementById('plUser').focus();
    document.getElementById('plForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const login = document.getElementById('plUser').value.trim().toLowerCase(), senha = document.getElementById('plSenha').value;
      const btn = document.getElementById('plBtn'), m = document.getElementById('plMsg');
      btn.disabled = true; btn.textContent = 'Entrando…'; m.textContent = '';
      const { error } = await sb.auth.signInWithPassword({ email: login.includes('@') ? login : login + '@' + DOMINIO, password: senha });
      if (error) { btn.disabled = false; btn.textContent = 'Entrar'; m.textContent = /invalid/i.test(error.message) ? 'Usuário ou senha incorretos.' : 'Não foi possível entrar agora. Tente de novo.'; return; }
      location.reload();
    });
  }

  /* ---------- app instalável (Android/Chrome) ---------- */
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  let pedido = null;
  const instalado = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); pedido = e;
    if (instalado() || document.getElementById('pInstalar') || localStorageGet('pInstalarNao')) return;
    const b = document.createElement('button'); b.id = 'pInstalar'; b.type = 'button';
    b.innerHTML = 'Instalar app <span>· Lista da Vez</span>';
    b.onclick = async () => { b.remove(); if (!pedido) return; pedido.prompt(); try { const r = await pedido.userChoice; if (r && r.outcome === 'dismissed') localStorageSet('pInstalarNao', '1'); } catch (x) {} pedido = null; };
    document.body.appendChild(b);
  });
  window.addEventListener('appinstalled', () => { const b = document.getElementById('pInstalar'); if (b) b.remove(); });
  function localStorageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  PAINEL.instalar = () => { if (pedido) { pedido.prompt(); pedido = null; return true; } return false; };
  PAINEL.sair = async () => { try { await sb.auth.signOut(); } catch (e) {} location.reload(); };

  const pronto = (async () => {
    const { data } = await sb.auth.getSession();
    if (!data.session) { telaLogin(); return new Promise(() => {}); }
    const { data: eu, error } = await sb.rpc('painel_eu');
    if (error || !eu || !eu.papel) {
      telaLogin(error ? 'Não foi possível verificar seu acesso. Tente entrar de novo.' : 'Seu usuário não tem acesso ao Painel das Lojas. Fale com o RH.');
      try { await sb.auth.signOut(); } catch (e) {}
      return new Promise(() => {});
    }
    PAINEL.eu = eu;
    return eu;
  })();
  PAINEL.pronto = pronto;

  /* ---------- banco (coleções → tabela painel_docs) ---------- */
  const caches = {}, ouvintes = {}, filtros = {}, timers = {};
  const emitir = (col) => {
    clearTimeout(timers[col]);
    timers[col] = setTimeout(() => {
      const c = caches[col] || {};
      const docs = Object.keys(c).map((id) => ({ id, data: () => c[id] }));
      (ouvintes[col] || []).forEach((f) => { try { f({ docs }); } catch (e) { console.error(e); } });
    }, 120);
  };
  const passa = (col, data) => { const w = filtros[col]; if (!w) return true; const v = data && data[w[0]]; return w[1] === '>=' ? (v != null && String(v) >= String(w[2])) : true; };
  let canal = null;
  function abrirCanal() {
    if (canal) return;
    canal = sb.channel('painel-docs').on('postgres_changes', { event: '*', schema: 'public', table: 'painel_docs' }, (p) => {
      const row = p.new && p.new.col ? p.new : p.old;
      if (!row || !row.col || !ouvintes[row.col]) return;
      const c = caches[row.col] || (caches[row.col] = {});
      if (p.eventType === 'DELETE') delete c[row.id];
      else if (passa(row.col, p.new.data)) c[row.id] = p.new.data; else delete c[row.id];
      emitir(row.col);
    }).subscribe();
  }
  async function carregar(col) {
    const out = {}; let de = 0; const passo = 1000;
    for (;;) {
      let q = sb.from('painel_docs').select('id,data').eq('col', col);
      const w = filtros[col]; if (w && w[1] === '>=') q = q.gte('data->>' + w[0], w[2]);
      const { data, error } = await q.order('id').range(de, de + passo - 1);
      if (error) throw error;
      data.forEach((r) => { out[r.id] = r.data; });
      if (data.length < passo) break; de += passo;
    }
    caches[col] = out;
  }
  const erro = (e) => { const x = new Error(e && e.message ? (/row-level security|permission/i.test(e.message) ? 'Seu usuário não tem permissão para alterar este dado.' : e.message) : 'Falha ao gravar.'); x.code = e && e.code; return x; };
  function colecao(col) {
    const api = {
      where(f, op, v) { filtros[col] = [f, op, v]; return api; },
      doc(id) {
        return {
          async set(data) { if (PAINEL.leitura) throw new Error('Modo "ver como": só visualização, nada foi gravado.'); const { error } = await sb.from('painel_docs').upsert({ col, id, data }, { onConflict: 'col,id' }); if (error) throw erro(error); (caches[col] || (caches[col] = {}))[id] = data; emitir(col); },
          async delete() { if (PAINEL.leitura) throw new Error('Modo "ver como": só visualização, nada foi gravado.'); const { error } = await sb.from('painel_docs').delete().eq('col', col).eq('id', id); if (error) throw erro(error); if (caches[col]) delete caches[col][id]; emitir(col); }
        };
      },
      onSnapshot(cb, errCb) {
        (ouvintes[col] || (ouvintes[col] = [])).push(cb);
        abrirCanal();
        carregar(col).then(() => emitir(col)).catch((e) => { console.error(e); errCb && errCb(e); });
        return () => { ouvintes[col] = (ouvintes[col] || []).filter((f) => f !== cb); };
      }
    };
    return api;
  }
  const db = { collection: colecao };

  /* ---------- usuário ---------- */
  const NOMES = {};
  const user = {
    async me() { const eu = await pronto; return { id: eu.id, name: eu.nome || '', canEdit: eu.papel === 'admin' }; },
    async id() { return (await pronto).id; },
    async isOwner() { return (await pronto).papel === 'admin'; },
    async canEdit() { return (await pronto).papel === 'admin'; },
    async can() { return true; },
    async profiles(ids) {
      const falta = ids.filter((i) => !(i in NOMES) && /^[0-9a-f-]{36}$/i.test(i));
      if (falta.length) { const { data } = await sb.rpc('painel_nomes', { ids: falta }); falta.forEach((i) => { NOMES[i] = (data && data[i]) || ''; }); }
      const o = {}; ids.forEach((i) => { o[i] = { name: NOMES[i] || '' }; }); return o;
    }
  };

  /* ---------- arquivos ---------- */
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }
  };

  PAINEL.fn = async (nome, corpo) => {
    const { data, error } = await sb.functions.invoke(nome, { body: corpo });
    if (error) { let msg = error.message; try { const j = await error.context.json(); if (j && j.erro) msg = j.erro; } catch (e) {} throw new Error(msg); }
    if (data && data.erro) throw new Error(data.erro);
    return data;
  };

  window.claude = {
    use: async (nome) => {
      await pronto;
      return nome === 'db' ? db : nome === 'user' ? user : nome === 'downloads' ? downloads : null;
    }
  };
})();
