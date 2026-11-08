/* =====================================================================
   EDITOR VISUAL — abre quando o endereço termina com #editar
   Edita textos clicando neles, troca/adiciona vídeos e fotos, muda a
   ordem dos itens e das seções e publica direto no GitHub.
   ===================================================================== */
(function () {
  "use strict";
  const P = window.Portfolio, C = P.C;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = P.esc;

  const css = document.createElement("link");
  css.rel = "stylesheet"; css.href = "editor.css";
  document.head.appendChild(css);

  /* ---------- estado ---------- */
  let original = JSON.stringify(C);
  const historico = [];
  const fila = new Map();           // caminho -> arquivo esperando para ser enviado
  const CHAVE = "editor-github";
  let cred = null;
  try { cred = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (e) {}

  P.editando = true;
  document.body.classList.add("modo-edicao");

  /* ---------- utilidades ---------- */
  const pai = (caminho) => {
    const k = caminho.split(".");
    const ult = k.pop();
    return [k.reduce((o, x) => o[x], C), isNaN(ult) ? ult : +ult];
  };
  const alterado = () => { const j = JSON.stringify(C); return j !== original || [...fila.keys()].some((k) => j.includes(`"${k}"`)); };
  function guardar() { historico.push(JSON.stringify(C)); if (historico.length > 80) historico.shift(); }
  function substituir(novo) { Object.keys(C).forEach((k) => delete C[k]); Object.assign(C, novo); }
  function atualizar() { P.render(); barra(); }

  function definirTexto(caminho, valor) {
    const [obj, k] = pai(caminho);
    const atual = obj[k];
    if (P.ehBilingue(atual)) atual[P.lang] = valor;
    else if (P.lang === "pt" || caminho === "perfil.nome" || caminho === "perfil.titulo" || /whatsappTexto|cidade/.test(caminho)) obj[k] = valor;
    else obj[k] = { pt: atual ?? "", en: valor };
  }
  const bil = (v, l) => (P.ehBilingue(v) ? v[l] ?? "" : l === "pt" ? v ?? "" : "");
  const fazBil = (pt, en) => (en ? { pt, en } : pt);

  const slug = (s) => (String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "arquivo");
  function adicionarArquivo(blob, pasta, nome, ext) {
    const caminho = `${slug(nome)}-${Date.now().toString(36)}.${ext}`; // todos os arquivos ficam soltos, na mesma pasta do site
    fila.set(caminho, blob);
    P.pendentes[caminho] = URL.createObjectURL(blob);
    return caminho;
  }
  function escolherArquivo(accept, multiplo = false) {
    return new Promise((ok) => {
      const i = document.createElement("input");
      i.type = "file"; i.accept = accept; i.multiple = multiplo;
      i.onchange = () => ok([...i.files]);
      i.click();
    });
  }
  async function redimensionar(arquivo, max = 1400) {
    const transparente = /png|webp/.test(arquivo.type);
    const bmp = await createImageBitmap(arquivo);
    const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const tipo = transparente ? "image/webp" : "image/jpeg";
    let blob = await new Promise((ok) => c.toBlob(ok, tipo, 0.86));
    if (!blob || blob.type !== tipo) blob = await new Promise((ok) => c.toBlob(ok, transparente ? "image/png" : "image/jpeg", 0.86));
    return { blob, ext: blob.type.split("/")[1].replace("jpeg", "jpg") };
  }
  function quadroDoVideo(video) {
    const c = document.createElement("canvas");
    const r = 540 / video.videoWidth;
    c.width = 540; c.height = Math.round(video.videoHeight * r);
    c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
    return new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.85));
  }
  function capaAutomatica(url) {
    return new Promise((ok, erro) => {
      const v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
      v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
      v.onseeked = () => quadroDoVideo(v).then(ok, erro);
      v.onerror = () => erro(new Error("vídeo"));
    });
  }
  const nuvem = () => (C.nuvem && C.nuvem.cloudName && C.nuvem.preset ? C.nuvem : null);
  function validarVideo(f) {
    const mb = f.size / 1048576;
    if (mb > 4000) { aviso(`Esse vídeo tem ${(mb / 1024).toFixed(1)} GB, grande demais para comprimir no navegador. Exporte em 1080p no CapCut antes.`, "erro"); return false; }
    if (mb > LIMITE_MB) aviso(`Vídeo de ${mb.toFixed(0)} MB: vou comprimir para 1080p antes de enviar. Deixe esta aba aberta.`);
    if (!nuvem()) {
      if (mb > 30) aviso(`Vídeo grande (${mb.toFixed(0)} MB). Ele funciona, mas vai carregar devagar no celular. O ideal é até 15 MB.`);
      if (/quicktime|\.mov$/i.test(f.type + f.name)) aviso("Arquivos .mov podem não tocar em todos os navegadores. Prefira exportar em .mp4.");
    }
    return true;
  }

  /* ---------- compressão no navegador (vídeos acima do limite) ---------- */
  const LIMITE_MB = 95;
  const MEDIABUNNY = new URL("mediabunny.min.mjs", document.baseURI).href; // Mediabunny 1.61.6 (MPL-2.0)
  async function comprimir(arquivo, progresso) {
    if (!("VideoEncoder" in window)) throw new Error("Este navegador não consegue comprimir vídeos. Use o Chrome ou o Edge no computador, ou exporte em 1080p no CapCut.");
    let MB;
    try { MB = await import(MEDIABUNNY); } catch (e) { throw new Error("Não consegui carregar o compressor de vídeo. Verifique a internet e tente de novo."); }
    const input = new MB.Input({ source: new MB.BlobSource(arquivo), formats: MB.ALL_FORMATS });
    let duracao = 0;
    try { duracao = await input.computeDuration(); } catch (e) {}
    // cabe em ~88 MB: bitrate do vídeo entre 1,5 e 6 Mbps (6 Mbps já é qualidade alta em 1080p vertical)
    const bitrate = duracao > 0 ? Math.max(1.5e6, Math.min(6e6, (88 * 8e6) / duracao - 192e3)) : 5e6;
    const aac = await MB.canEncodeAudio("aac").catch(() => false);
    const output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: "in-memory" }), target: new MB.BufferTarget() });
    const conversao = await MB.Conversion.init({
      input, output, tracks: "primary",
      video: (track) => {
        const w = track.displayWidth, h = track.displayHeight, k = Math.min(1, 1080 / Math.min(w, h));
        return { width: Math.round((w * k) / 2) * 2, height: Math.round((h * k) / 2) * 2, fit: "contain", codec: "avc", bitrate, forceTranscode: true };
      },
      audio: { codec: aac ? "aac" : "opus", bitrate: 160e3 }
    });
    const perdeu = conversao.discardedTracks.find((d) => d.track.type === "audio" || d.track.type === "video");
    if (!conversao.isValid || perdeu) throw new Error("Este navegador não conseguiu converter esse vídeo sem perder o áudio ou a imagem. Tente no Chrome do computador, ou exporte em 1080p no CapCut.");
    conversao.onProgress = (x) => progresso?.(x);
    await conversao.execute();
    const novo = new File([output.target.buffer], arquivo.name.replace(/\.[^.]+$/, "") + "-1080p.mp4", { type: "video/mp4" });
    if (novo.size > 99 * 1048576) throw new Error("Mesmo comprimido, o vídeo passou de 100 MB (ele é muito longo). Corte o vídeo ou divida em partes.");
    return novo;
  }

  /* ---------- vídeos no Cloudinary ---------- */
  const baseNuvem = () => `https://res.cloudinary.com/${nuvem().cloudName}/video/upload`;
  const dadosNuvem = (url) => {
    const m = /res\.cloudinary\.com\/[^/]+\/video\/upload\/(?:[^/]*_[^/]*\/)?(v\d+)\/(.+)\.\w+$/.exec(url || "");
    return m ? { versao: m[1], id: m[2] } : null;
  };
  const capaNuvem = (url, segundos = 1) => {
    const d = dadosNuvem(url);
    return d ? `${url.split("/video/upload/")[0]}/video/upload/so_${Math.max(0, segundos).toFixed(1)},w_540,c_scale,q_auto/${d.versao}/${d.id}.jpg` : "";
  };
  function enviarNuvem(arquivo, nome, progresso) {
    const n = nuvem();
    return new Promise((ok, erro) => {
      const fd = new FormData();
      fd.append("file", arquivo);
      fd.append("upload_preset", n.preset);
      if (n.pasta) fd.append("folder", n.pasta);
      fd.append("public_id", `${slug(nome)}-${Date.now().toString(36)}`);
      const x = new XMLHttpRequest();
      x.open("POST", `https://api.cloudinary.com/v1_1/${n.cloudName}/video/upload`);
      x.upload.onprogress = (e) => e.lengthComputable && progresso?.(e.loaded / e.total);
      x.onload = () => {
        let r = null; try { r = JSON.parse(x.responseText); } catch (e) {}
        if (x.status < 300 && r?.public_id) return ok(r);
        const msg = r?.error?.message || `erro ${x.status}`;
        erro(new Error(/preset/i.test(msg) ? "O Cloudinary recusou o envio: confira se o upload preset existe e está como Unsigned." : `O Cloudinary recusou o vídeo (${msg}).`));
      };
      x.onerror = () => erro(new Error("Sem conexão com o Cloudinary. Verifique a internet."));
      x.send(fd);
    });
  }
  /* Guarda um vídeo (no Cloudinary, se configurado; senão no GitHub) e devolve { video, capa } */
  async function guardarVideo(arquivo, nome, progresso) {
    if (arquivo.size > LIMITE_MB * 1048576) {
      arquivo = await comprimir(arquivo, (x) => progresso?.(x, "comprimindo"));
      aviso(`Vídeo comprimido para ${(arquivo.size / 1048576).toFixed(0)} MB. Enviando…`);
    }
    if (nuvem()) {
      const r = await enviarNuvem(arquivo, nome, progresso);
      const grande = r.bytes > 40 * 1048576 && /mp4|webm/.test(r.format);
      const video = grande ? r.secure_url : `${baseNuvem()}/q_auto,vc_h264,w_1080,c_limit/v${r.version}/${r.public_id}.mp4`;
      return { video, capa: capaNuvem(video, 1) };
    }
    const video = adicionarArquivo(arquivo, "videos", nome, extDe(arquivo, "mp4"));
    let capa = "";
    try { capa = adicionarArquivo(await capaAutomatica(P.pendentes[video]), "capas", nome, "jpg"); } catch (err) {}
    progresso?.(1);
    return { video, capa };
  }
  const extDe = (f, padrao) => (f.name.split(".").pop() || padrao).toLowerCase();

  /* ---------- avisos e perguntas ---------- */
  function aviso(msg, tipo = "") {
    const d = document.createElement("div");
    d.className = "ed-aviso " + tipo; d.textContent = msg; d.setAttribute("role", "status");
    $("#ed-avisos").appendChild(d);
    setTimeout(() => d.classList.add("saindo"), tipo === "erro" ? 7000 : 4200);
    setTimeout(() => d.remove(), tipo === "erro" ? 7500 : 4700);
  }
  function perguntar(msg, sim = "Sim", nao = "Cancelar") {
    return new Promise((ok) => {
      const d = document.createElement("div");
      d.className = "ed-pergunta";
      d.innerHTML = `<div class="ed-pergunta__caixa" role="alertdialog" aria-modal="true"><p>${esc(msg)}</p><div><button class="ed-bt" data-r="0">${esc(nao)}</button><button class="ed-bt ed-bt--forte" data-r="1">${esc(sim)}</button></div></div>`;
      d.addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (b) { d.remove(); ok(b.dataset.r === "1"); } });
      document.body.appendChild(d); $("[data-r='1']", d).focus();
    });
  }

  /* ---------- barra de ferramentas ---------- */
  const ui = document.createElement("div");
  ui.innerHTML = `
    <div class="ed-barra" id="ed-barra" role="toolbar" aria-label="Editor">
      <span class="ed-barra__titulo"><svg class="flor" viewBox="0 0 100 100"><use href="#flor"/></svg> Modo edição</span>
      <span class="ed-barra__idioma">Textos em <b id="ed-idioma"></b></span>
      <button class="ed-bt" id="ed-desfazer" title="Desfazer (Ctrl+Z)">↶ Desfazer</button>
      <button class="ed-bt" id="ed-secoes">Seções</button>
      <button class="ed-bt" id="ed-config">Contato e categorias</button>
      <button class="ed-bt ed-bt--forte" id="ed-publicar">Publicar</button>
      <button class="ed-bt ed-bt--fantasma" id="ed-sair" title="Sair do modo edição">Sair</button>
    </div>
    <aside class="ed-painel" id="ed-painel" hidden aria-labelledby="ed-painel-titulo">
      <header><h2 id="ed-painel-titulo"></h2><button class="ed-x" id="ed-painel-fechar" aria-label="Fechar">×</button></header>
      <div class="ed-painel__corpo" id="ed-painel-corpo"></div>
    </aside>
    <div class="ed-avisos" id="ed-avisos" aria-live="polite"></div>
    <div class="ed-dica" id="ed-dica">Clique em qualquer texto para editar. Passe o mouse sobre vídeos, fotos e itens para mudar a ordem, editar ou apagar.<button class="ed-x" aria-label="Fechar dica">×</button></div>`;
  document.body.append(...ui.children);
  $("#ed-dica .ed-x").onclick = () => $("#ed-dica").remove();

  function barra() {
    $("#ed-idioma").textContent = P.lang === "en" ? "inglês" : "português";
    $("#ed-desfazer").disabled = !historico.length;
    const n = alterado();
    $("#ed-publicar").textContent = n ? "Publicar alterações" : "Publicado ✓";
    $("#ed-publicar").classList.toggle("ed-pulsa", n);
  }
  $("#ed-desfazer").onclick = desfazer;
  function desfazer() {
    if (!historico.length) return;
    substituir(JSON.parse(historico.pop())); atualizar();
  }
  addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.target.isContentEditable && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); desfazer(); }
  });
  addEventListener("beforeunload", (e) => { if (alterado()) { e.preventDefault(); e.returnValue = ""; } });
  $("#ed-sair").onclick = async () => {
    if (alterado() && !(await perguntar("Você tem alterações não publicadas. Sair mesmo assim? Elas serão perdidas.", "Sair sem publicar"))) return;
    original = JSON.stringify(C); fila.clear();
    history.replaceState(null, "", location.pathname + location.search);
    location.reload();
  };

  /* ---------- painel lateral ---------- */
  function abrirPainel(titulo, html, montar) {
    $("#ed-painel-titulo").textContent = titulo;
    const velho = $("#ed-painel-corpo"), corpo = velho.cloneNode(false);
    velho.replaceWith(corpo); // painel limpo, sem eventos do painel anterior
    corpo.innerHTML = html;
    $("#ed-painel").hidden = false;
    document.body.classList.add("ed-com-painel");
    montar?.($("#ed-painel-corpo"));
    $("#ed-painel-corpo input, #ed-painel-corpo button")?.focus();
  }
  function fecharPainel() {
    $$("#ed-painel video").forEach((v) => v.pause());
    $("#ed-painel").hidden = true;
    document.body.classList.remove("ed-com-painel");
  }
  $("#ed-painel-fechar").onclick = fecharPainel;
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#ed-painel").hidden) fecharPainel(); });

  /* ---------- edição de textos direto na página ---------- */
  document.addEventListener("focusin", (e) => {
    const el = e.target.closest?.("[data-e][contenteditable]");
    if (el) el.dataset.antes = el.innerHTML;
  });
  document.addEventListener("focusout", (e) => {
    const el = e.target.closest?.("[data-e][contenteditable]");
    if (!el || el.innerHTML === el.dataset.antes) return;
    let v;
    if ("rico" in el.dataset) v = el.innerHTML.replace(/<em>(.*?)<\/em>/gi, "*$1*").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
    else v = el.textContent;
    const tmp = document.createElement("textarea"); tmp.innerHTML = v; v = tmp.value.replace(/\s+/g, " ").trim();
    guardar();
    definirTexto(el.dataset.e, v);
    atualizar();
  });
  document.addEventListener("keydown", (e) => {
    const el = e.target.closest?.("[data-e][contenteditable]");
    if (!el) return;
    if (e.key === "Enter") { e.preventDefault(); el.blur(); }
    if (e.key === "Escape") { el.innerHTML = el.dataset.antes; el.blur(); }
  });
  document.addEventListener("paste", (e) => {
    const el = e.target.closest?.("[data-e][contenteditable]");
    if (!el) return;
    e.preventDefault();
    document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain").replace(/\s+/g, " "));
  });
  // no modo edição, links não saem da página (exceto o menu)
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a || a.closest(".ed-painel, .ed-barra")) return;
    const h = a.getAttribute("href") || "";
    if (!h.startsWith("#")) e.preventDefault();
    if (e.target.closest("[contenteditable]")) e.preventDefault();
  }, true);

  /* ---------- controles sobre itens ---------- */
  const rotuloLista = {
    "perfil.fatos": "informação", "perfil.interesses": "interesse", "perfil.diferenciais": "diferencial",
    servicos: "serviço", processo: "etapa", pacotes: "pacote"
  };
  function moverItem(caminho, direcao) {
    const el = document.querySelector(`[data-item="${caminho}"]`);
    let viz = direcao < 0 ? el.previousElementSibling : el.nextElementSibling;
    while (viz && !viz.dataset.item) viz = direcao < 0 ? viz.previousElementSibling : viz.nextElementSibling;
    if (!viz) return;
    const [lista, i] = pai(caminho);
    const j = +viz.dataset.item.split(".").pop();
    guardar();
    [lista[i], lista[j]] = [lista[j], lista[i]];
    atualizar();
  }
  async function apagarItem(caminho, nome) {
    const [lista, i] = pai(caminho);
    if (lista.length <= 1 && !/^(videos|fotos)$/.test(caminho.split(".")[0])) return aviso("Esse é o último item da lista. Edite o texto em vez de apagar.");
    if (!(await perguntar(`Apagar ${nome}?`, "Apagar"))) return;
    guardar(); lista.splice(i, 1); atualizar();
  }
  function botoesItem(caminho, extras = "") {
    return `<div class="ed-ctrl" contenteditable="false">
      <button type="button" data-acao="antes" data-c="${caminho}" title="Mover para trás" aria-label="Mover para trás">◀</button>
      <button type="button" data-acao="depois" data-c="${caminho}" title="Mover para frente" aria-label="Mover para frente">▶</button>
      ${extras}
      <button type="button" data-acao="apagar" data-c="${caminho}" title="Apagar" aria-label="Apagar">✕</button></div>`;
  }

  function prepararPagina() {
    // textos editáveis
    $$("main [data-e], footer [data-e]").forEach((el) => {
      el.contentEditable = "true"; el.spellcheck = true;
      el.setAttribute("aria-label", "Texto editável");
    });
    // botões de ordem/apagar nos itens das listas
    $$("[data-item]").forEach((el) => {
      if (el.querySelector(":scope > .ed-ctrl")) return;
      const c = el.dataset.item;
      const raiz = c.split(".")[0];
      let extras = "";
      if (raiz === "videos") extras = `<button type="button" data-acao="editar-video" data-c="${c}" title="Editar vídeo">✎ Editar</button>`;
      if (raiz === "fotos") extras = `<button type="button" data-acao="editar-foto" data-c="${c}" title="Editar foto">✎</button>`;
      if (/^pacotes\.\d+$/.test(c)) extras = `<button type="button" data-acao="destaque" data-c="${c}" title="Marcar como destaque">★</button>`;
      el.insertAdjacentHTML("beforeend", botoesItem(c, extras));
    });
    // botão "adicionar" no fim de cada lista de texto
    $$("[data-lista]").forEach((lista) => {
      if (lista.nextElementSibling?.classList.contains("ed-add")) return;
      const c = lista.dataset.lista;
      const nome = rotuloLista[c] || "item";
      lista.insertAdjacentHTML("afterend", `<button type="button" class="ed-add" data-acao="adicionar" data-c="${c}">+ Adicionar ${nome}</button>`);
    });
    // trocar foto da capa / vídeo do "sobre"
    $$("[data-img]").forEach((el) => {
      const alvo = el.tagName === "IMG" ? el.parentElement : el;
      if (alvo.querySelector(":scope > .ed-trocar")) return;
      const video = el.dataset.tipoMidia === "video";
      alvo.insertAdjacentHTML("beforeend", `<button type="button" class="ed-trocar" data-acao="trocar-midia" data-c="${el.dataset.img}" data-video="${video}">${video ? "Trocar vídeo" : "Trocar foto"}</button>`);
    });
    // seções ocultas aparecem apagadas no editor
    C.secoes.forEach((s) => { const el = document.getElementById(s.id); if (el) el.hidden = false, el.classList.toggle("ed-oculta", !s.visivel); });
    barra();
  }
  function prepararVideos() {
    const g = $("#grade-videos");
    $$("#grade-videos [data-item]").forEach((el) => {
      if (!el.querySelector(":scope > .ed-ctrl")) el.insertAdjacentHTML("beforeend", botoesItem(el.dataset.item, `<button type="button" data-acao="editar-video" data-c="${el.dataset.item}">✎ Editar</button>`));
    });
    if (!$(".ed-novo-video", g)) g.insertAdjacentHTML("afterbegin", `<li class="ed-novo ed-novo-video"><button type="button" data-acao="novo-video"><span>+</span>Adicionar vídeo</button></li>`);
  }
  function prepararFotos() {
    const g = $("#grade-fotos");
    if (!$(".ed-novo-foto", g)) g.insertAdjacentHTML("afterbegin", `<li class="ed-novo ed-novo-foto"><button type="button" data-acao="nova-foto"><span>+</span>Adicionar fotos</button></li>`);
  }
  P.depoisRender = () => { prepararPagina(); prepararFotos(); };
  P.depoisVideos = prepararVideos;

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-acao]");
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const c = b.dataset.c, acao = b.dataset.acao;
    if (acao === "antes") moverItem(c, -1);
    if (acao === "depois") moverItem(c, 1);
    if (acao === "apagar") {
      const raiz = c.split(".")[0];
      apagarItem(c, raiz === "videos" ? `o vídeo "${P.t(P.pegar(c + ".titulo"))}"` : raiz === "fotos" ? "esta foto" : "este item");
    }
    if (acao === "destaque") { guardar(); const p = P.pegar(c); C.pacotes.forEach((x) => x !== p && (x.destaque = false)); p.destaque = !p.destaque; atualizar(); }
    if (acao === "adicionar") {
      const lista = P.pegar(c);
      guardar();
      lista.push(JSON.parse(JSON.stringify(lista[lista.length - 1] ?? "Novo item")));
      atualizar();
      aviso("Item adicionado no fim da lista. Clique no texto para escrever.");
    }
    if (acao === "trocar-midia") trocarMidia(c, b.dataset.video === "true");
    if (acao === "editar-video") painelVideo(+c.split(".")[1]);
    if (acao === "novo-video") novoVideo();
    if (acao === "editar-foto") painelFoto(+c.split(".")[1]);
    if (acao === "nova-foto") novasFotos();
  }, true);

  async function trocarMidia(caminho, video) {
    const [f] = await escolherArquivo(video ? "video/mp4,video/webm,video/quicktime" : "image/*");
    if (!f) return;
    guardar();
    if (video) {
      if (!validarVideo(f)) return historico.pop();
      aviso("Enviando o vídeo… aguarde.");
      try {
        const r = await guardarVideo(f, "sobre-mim");
        C.perfil.videoSobre = r.video; C.perfil.capaVideoSobre = r.capa;
        aviso("Vídeo trocado.", "ok");
      } catch (err) { historico.pop(); return aviso(err.message, "erro"); }
    } else {
      const { blob, ext } = await redimensionar(f, 1400);
      const [obj, k] = pai(caminho);
      obj[k] = adicionarArquivo(blob, "site", k, ext);
      if (/fotoCapa/.test(caminho) && !/png|webp/.test(f.type)) aviso("Dica: na capa, uma foto com fundo transparente (PNG) fica mais bonita. O remove.bg faz isso de graça.");
    }
    atualizar();
  }

  /* ---------- vídeos ---------- */
  const opcoesCat = (sel) => C.categorias.map((c) => `<option value="${esc(c.id)}"${c.id === sel ? " selected" : ""}>${esc(P.t(c.nome))}</option>`).join("");
  function camposBil(id, rotulo, valor, dica = "") {
    return `<div class="ed-duplo"><label>${rotulo} <small>português</small><input id="${id}-pt" value="${esc(bil(valor, "pt"))}"></label>
      <label>${rotulo} <small>inglês</small><input id="${id}-en" value="${esc(bil(valor, "en"))}"></label>${dica ? `<p class="ed-nota">${dica}</p>` : ""}</div>`;
  }
  const lerBil = (corpo, id) => fazBil($(`#${id}-pt`, corpo).value.trim(), $(`#${id}-en`, corpo).value.trim());
  const lerEtiquetas = (corpo) => {
    const pt = $("#ed-e-pt", corpo).value.split(",").map((s) => s.trim()).filter(Boolean);
    const en = $("#ed-e-en", corpo).value.split(",").map((s) => s.trim());
    return pt.map((s, i) => fazBil(s, en[i] || ""));
  };

  async function novoVideo() {
    const [f] = await escolherArquivo("video/mp4,video/webm,video/quicktime");
    if (!f || !validarVideo(f)) return;
    const nome = f.name.replace(/\.[^.]+$/, "");
    const filtroAtivo = $(".filtro[aria-selected='true']")?.dataset.filtro;
    const rascunho = { titulo: { pt: "Novo vídeo", en: "New video" }, categoria: C.categorias.some((c) => c.id === filtroAtivo) ? filtroAtivo : C.categorias[0]?.id, formato: "", etiquetas: [], video: "", capa: "" };
    painelVideo(null, rascunho, { arquivo: f, nome });
  }

  function painelVideo(indice, rascunho, envioInicial) {
    const novo = indice === null;
    const v = JSON.parse(JSON.stringify(novo ? rascunho : C.videos[indice]));
    let enviando = false;
    abrirPainel(novo ? "Novo vídeo" : "Editar vídeo", `
      <div class="ed-progresso" id="ed-v-prog" hidden><div><span></span></div><p>Enviando vídeo… 0%</p></div>
      <div class="ed-video-prev">
        <video id="ed-v-prev" src="${esc(P.src(v.video))}" controls playsinline preload="metadata" crossorigin="anonymous"></video>
        <div class="ed-capa-prev"><img id="ed-v-capa" src="${esc(P.src(v.capa))}" alt="Capa atual"><small>Capa</small></div>
      </div>
      <div class="ed-linha">
        <button type="button" class="ed-bt" id="ed-v-quadro">Usar o momento atual do vídeo como capa</button>
        <button type="button" class="ed-bt ed-bt--fantasma" id="ed-v-capa-arq">Enviar imagem de capa</button>
        <button type="button" class="ed-bt ed-bt--fantasma" id="ed-v-arq">Trocar arquivo do vídeo</button>
      </div>
      ${camposBil("ed-t", "Título", v.titulo)}
      <label>Categoria<select id="ed-v-cat">${opcoesCat(v.categoria)}</select></label>
      ${camposBil("ed-f", "Formato", v.formato, "Ex.: Review, Unboxing, Anúncio, Storytelling, ASMR.")}
      <div class="ed-duplo"><label>Etiquetas <small>português</small><input id="ed-e-pt" value="${esc((v.etiquetas || []).map((e) => bil(e, "pt")).join(", "))}"></label>
        <label>Etiquetas <small>inglês</small><input id="ed-e-en" value="${esc((v.etiquetas || []).map((e) => bil(e, "en")).join(", "))}"></label>
        <p class="ed-nota">Separe por vírgula, na mesma ordem nos dois idiomas. Ex.: Narração, Inglês / Voiceover, English.</p></div>
      <div class="ed-acoes">
        ${novo ? "" : '<button type="button" class="ed-bt ed-bt--perigo" id="ed-v-apagar">Apagar vídeo</button>'}
        <button type="button" class="ed-bt ed-bt--forte" id="ed-v-salvar">${novo ? "Adicionar ao portfólio" : "Salvar"}</button>
      </div>`, (corpo) => {
      const prev = $("#ed-v-prev", corpo);
      const salvar = $("#ed-v-salvar", corpo);
      async function enviar(arquivo, nome) {
        const prog = $("#ed-v-prog", corpo), barraP = $("span", prog), txt = $("p", prog);
        enviando = true; salvar.disabled = true; prog.hidden = false;
        prev.src = URL.createObjectURL(arquivo);
        const mostrar = (x, fase) => {
          barraP.style.width = `${Math.round(x * 100)}%`;
          txt.textContent = fase === "comprimindo" ? `Comprimindo para 1080p… ${Math.round(x * 100)}% (deixe esta aba aberta)` : x < 1 ? `Enviando vídeo… ${Math.round(x * 100)}%` : "Processando…";
        };
        mostrar(0);
        try {
          const r = await guardarVideo(arquivo, nome, mostrar);
          v.video = r.video;
          if (r.capa) { v.capa = r.capa; $("#ed-v-capa", corpo).src = P.src(r.capa); }
          txt.textContent = "Vídeo enviado ✓"; barraP.style.width = "100%";
        } catch (err) {
          txt.textContent = err.message; prog.classList.add("erro");
          aviso(err.message, "erro");
        } finally { enviando = false; salvar.disabled = !v.video; }
      }
      if (envioInicial) enviar(envioInicial.arquivo, envioInicial.nome);
      $("#ed-v-quadro", corpo).onclick = async () => {
        if (!prev.videoWidth && !prev.currentTime) return aviso("Dê play no vídeo e pause no momento que quer usar.");
        if (dadosNuvem(v.video)) {
          v.capa = capaNuvem(v.video, prev.currentTime);
          $("#ed-v-capa", corpo).src = v.capa;
          return aviso("Capa atualizada. Clique em Salvar para confirmar.");
        }
        try {
          const blob = await quadroDoVideo(prev);
          v.capa = adicionarArquivo(blob, "capas", P.t(v.titulo), "jpg");
          $("#ed-v-capa", corpo).src = P.src(v.capa);
          aviso("Capa atualizada. Clique em Salvar para confirmar.");
        } catch (err) { aviso("Não foi possível capturar esse quadro. Envie uma imagem de capa.", "erro"); }
      };
      $("#ed-v-capa-arq", corpo).onclick = async () => {
        const [f] = await escolherArquivo("image/*"); if (!f) return;
        const { blob, ext } = await redimensionar(f, 900);
        v.capa = adicionarArquivo(blob, "capas", P.t(v.titulo), ext);
        $("#ed-v-capa", corpo).src = P.src(v.capa);
      };
      $("#ed-v-arq", corpo).onclick = async () => {
        const [f] = await escolherArquivo("video/mp4,video/webm,video/quicktime");
        if (!f || !validarVideo(f)) return;
        enviar(f, P.t(v.titulo));
      };
      salvar.onclick = () => {
        if (enviando || !v.video) return aviso("Espere o vídeo terminar de enviar.");
        v.titulo = lerBil(corpo, "ed-t");
        v.formato = lerBil(corpo, "ed-f");
        v.categoria = $("#ed-v-cat", corpo).value;
        v.etiquetas = lerEtiquetas(corpo);
        guardar();
        if (novo) C.videos.unshift(v); else C.videos[indice] = v;
        fecharPainel(); atualizar();
        aviso(novo ? "Vídeo adicionado no início do portfólio. Use ◀ ▶ para mudar a posição." : "Vídeo atualizado.");
      };
      $("#ed-v-apagar", corpo)?.addEventListener("click", async () => {
        if (!(await perguntar("Apagar este vídeo do portfólio?", "Apagar"))) return;
        guardar(); C.videos.splice(indice, 1); fecharPainel(); atualizar();
      });
    });
  }

  /* ---------- fotos ---------- */
  async function novasFotos() {
    const arquivos = await escolherArquivo("image/*", true);
    if (!arquivos.length) return;
    aviso(`Preparando ${arquivos.length} foto(s)…`);
    const novas = [];
    for (const f of arquivos) {
      const { blob, ext } = await redimensionar(f, 1400);
      novas.push({ arquivo: adicionarArquivo(blob, "fotos", f.name.replace(/\.[^.]+$/, ""), ext), descricao: { pt: "", en: "" } });
    }
    guardar(); C.fotos.unshift(...novas); atualizar();
    aviso("Fotos adicionadas no início da galeria. Clique em ✎ para escrever a descrição.");
  }
  function painelFoto(i) {
    const f = C.fotos[i];
    abrirPainel("Editar foto", `
      <img class="ed-foto-prev" id="ed-f-img" src="${esc(P.src(f.arquivo))}" alt="">
      <button type="button" class="ed-bt ed-bt--fantasma" id="ed-f-trocar">Trocar imagem</button>
      ${camposBil("ed-d", "Descrição", f.descricao, "Não aparece na tela: ajuda o Google e quem usa leitor de tela.")}
      <div class="ed-acoes"><button type="button" class="ed-bt ed-bt--perigo" id="ed-f-apagar">Apagar foto</button><button type="button" class="ed-bt ed-bt--forte" id="ed-f-salvar">Salvar</button></div>`, (corpo) => {
      let arquivo = f.arquivo;
      $("#ed-f-trocar", corpo).onclick = async () => {
        const [a] = await escolherArquivo("image/*"); if (!a) return;
        const { blob, ext } = await redimensionar(a, 1400);
        arquivo = adicionarArquivo(blob, "fotos", a.name.replace(/\.[^.]+$/, ""), ext);
        $("#ed-f-img", corpo).src = P.src(arquivo);
      };
      $("#ed-f-salvar", corpo).onclick = () => { guardar(); C.fotos[i] = { arquivo, descricao: lerBil(corpo, "ed-d") }; fecharPainel(); atualizar(); };
      $("#ed-f-apagar", corpo).onclick = async () => {
        if (!(await perguntar("Apagar esta foto?", "Apagar"))) return;
        guardar(); C.fotos.splice(i, 1); fecharPainel(); atualizar();
      };
    });
  }

  /* ---------- seções ---------- */
  $("#ed-secoes").onclick = painelSecoes;
  function painelSecoes() {
    abrirPainel("Seções do site", `
      <p class="ed-nota">A capa fica sempre no topo e o contato sempre no fim. Mude a ordem das outras seções, esconda as que não quiser mostrar e renomeie o menu.</p>
      <ol class="ed-secoes">${C.secoes.map((s, i) => `
        <li class="${s.visivel ? "" : "oculta"}">
          <div class="ed-secoes__ordem"><button type="button" class="ed-mini" data-s="sobe" data-i="${i}" aria-label="Subir" ${i ? "" : "disabled"}>▲</button><button type="button" class="ed-mini" data-s="desce" data-i="${i}" aria-label="Descer" ${i < C.secoes.length - 1 ? "" : "disabled"}>▼</button></div>
          <div class="ed-secoes__nomes"><input data-s="pt" data-i="${i}" value="${esc(bil(s.nome, "pt"))}" aria-label="Nome em português"><input data-s="en" data-i="${i}" value="${esc(bil(s.nome, "en"))}" aria-label="Nome em inglês" placeholder="em inglês"></div>
          <label class="ed-chave"><input type="checkbox" data-s="ver" data-i="${i}" ${s.visivel ? "checked" : ""}> Mostrar</label>
        </li>`).join("")}</ol>`, (corpo) => {
      corpo.onclick = (e) => {
        const b = e.target.closest("button[data-s]"); if (!b) return;
        const i = +b.dataset.i, j = b.dataset.s === "sobe" ? i - 1 : i + 1;
        guardar(); [C.secoes[i], C.secoes[j]] = [C.secoes[j], C.secoes[i]];
        atualizar(); painelSecoes();
        document.getElementById(C.secoes[j].id)?.scrollIntoView({ behavior: "smooth" });
      };
      corpo.onchange = (e) => {
        const el = e.target, i = +el.dataset.i, s = C.secoes[i];
        guardar();
        if (el.dataset.s === "ver") { s.visivel = el.checked; el.closest("li").classList.toggle("oculta", !el.checked); }
        else { const pt = bil(s.nome, "pt"), en = bil(s.nome, "en"); s.nome = el.dataset.s === "pt" ? fazBil(el.value.trim(), en) : fazBil(pt, el.value.trim()); }
        atualizar();
      };
    });
  }

  /* ---------- contato e categorias ---------- */
  $("#ed-config").onclick = painelConfig;
  function painelConfig() {
    const ct = C.contato;
    abrirPainel("Contato, redes e categorias", `
      <h3>Contato</h3>
      <label>Seu nome<input id="ed-c-nome" value="${esc(C.perfil.nome)}"></label>
      <label>WhatsApp (só números, com 55 e DDD)<input id="ed-c-whats" inputmode="numeric" value="${esc(ct.whatsapp)}"></label>
      <label>WhatsApp como aparece no site<input id="ed-c-whatstexto" value="${esc(ct.whatsappTexto)}"></label>
      <div class="ed-duplo"><label>Mensagem automática <small>português</small><textarea id="ed-c-msg-pt" rows="2">${esc(bil(ct.mensagemWhatsapp, "pt"))}</textarea></label>
        <label>Mensagem automática <small>inglês</small><textarea id="ed-c-msg-en" rows="2">${esc(bil(ct.mensagemWhatsapp, "en"))}</textarea></label>
        <p class="ed-nota">Texto que já vem escrito quando a marca clica no botão do WhatsApp.</p></div>
      <label>E-mail<input id="ed-c-email" type="email" value="${esc(ct.email)}"></label>
      <h3>Redes sociais</h3>
      <div id="ed-redes">${ct.redes.map((r) => linhaRede(r)).join("")}</div>
      <button type="button" class="ed-bt ed-bt--fantasma" id="ed-rede-add">+ Adicionar rede</button>
      <h3>Onde ficam os vídeos (Cloudinary)</h3>
      <div class="ed-duplo"><label>Cloud name<input id="ed-n-cloud" value="${esc(C.nuvem?.cloudName || "")}"></label>
        <label>Upload preset<input id="ed-n-preset" value="${esc(C.nuvem?.preset || "")}"></label>
        <p class="ed-nota">Vídeos novos vão para o Cloudinary. Deixe em branco para guardar os vídeos no GitHub.</p></div>
      <h3>Estatísticas (Umami)</h3>
      <label>Website ID<input id="ed-u-id" value="${esc(C.estatisticas?.umamiId || "")}" placeholder="ex.: 9674665b-26f7-…"></label>
      <p class="ed-nota">Veja visitas e cliques em cloud.umami.is. Deixe vazio para desligar.</p>
      <h3>Letreiro (faixa que corre embaixo da capa)</h3>
      <div class="ed-duplo"><label>Palavras <small>português</small><textarea id="ed-l-pt" rows="6">${esc((C.textos.letreiro || []).map((x) => bil(x, "pt")).join("\n"))}</textarea></label>
        <label>Palavras <small>inglês</small><textarea id="ed-l-en" rows="6">${esc((C.textos.letreiro || []).map((x) => bil(x, "en")).join("\n"))}</textarea></label>
        <p class="ed-nota">Uma palavra ou expressão por linha, na mesma ordem nos dois idiomas. Deixe vazio para esconder o letreiro.</p></div>
      <h3>Categorias dos vídeos</h3>
      <p class="ed-nota">Cada categoria vira um botão de filtro. Para apagar uma categoria, mova antes os vídeos dela para outra.</p>
      <div id="ed-cats">${C.categorias.map((c) => linhaCat(c)).join("")}</div>
      <button type="button" class="ed-bt ed-bt--fantasma" id="ed-cat-add">+ Adicionar categoria</button>
      <div class="ed-acoes"><button type="button" class="ed-bt ed-bt--forte" id="ed-c-salvar">Salvar</button></div>`, (corpo) => {
      $("#ed-rede-add", corpo).onclick = () => $("#ed-redes", corpo).insertAdjacentHTML("beforeend", linhaRede({ rede: "instagram", usuario: "@", link: "https://" }));
      $("#ed-cat-add", corpo).onclick = () => $("#ed-cats", corpo).insertAdjacentHTML("beforeend", linhaCat({ id: "", nome: { pt: "", en: "" } }));
      corpo.addEventListener("click", (e) => { const x = e.target.closest(".ed-rm"); if (x) x.parentElement.remove(); });
      $("#ed-c-salvar", corpo).onclick = () => {
        const cats = $$(".ed-cat", corpo).map((l) => {
          const pt = $(".cat-pt", l).value.trim(), en = $(".cat-en", l).value.trim();
          return { id: l.dataset.id || slug(pt), nome: fazBil(pt, en) };
        }).filter((c) => bil(c.nome, "pt"));
        const orfaos = C.videos.filter((v) => !cats.some((c) => c.id === v.categoria));
        if (orfaos.length) return aviso(`Ainda há ${orfaos.length} vídeo(s) em uma categoria que você removeu. Mude a categoria deles antes.`, "erro");
        guardar();
        C.perfil.nome = $("#ed-c-nome", corpo).value.trim() || C.perfil.nome;
        ct.whatsapp = $("#ed-c-whats", corpo).value.replace(/\D/g, "");
        ct.whatsappTexto = $("#ed-c-whatstexto", corpo).value.trim();
        ct.mensagemWhatsapp = fazBil($("#ed-c-msg-pt", corpo).value.trim(), $("#ed-c-msg-en", corpo).value.trim());
        ct.email = $("#ed-c-email", corpo).value.trim();
        ct.redes = $$(".ed-rede", corpo).map((l) => ({ rede: $("select", l).value, usuario: $(".r-u", l).value.trim(), link: $(".r-l", l).value.trim() })).filter((r) => r.link.length > 8);
        C.categorias = cats;
        const uid = $("#ed-u-id", corpo).value.trim();
        if (uid) C.estatisticas = { umamiId: uid }; else delete C.estatisticas;
        const lpt = $("#ed-l-pt", corpo).value.split("\n").map((x) => x.trim()), len = $("#ed-l-en", corpo).value.split("\n").map((x) => x.trim());
        C.textos.letreiro = lpt.map((x, i) => (x ? fazBil(x, len[i] || "") : null)).filter(Boolean);
        const cloud = $("#ed-n-cloud", corpo).value.trim(), preset = $("#ed-n-preset", corpo).value.trim();
        C.nuvem = cloud && preset ? { ...(C.nuvem || {}), cloudName: cloud, preset } : null;
        fecharPainel(); atualizar(); aviso("Informações salvas.");
      };
    });
  }
  function linhaRede(r) {
    return `<div class="ed-rede"><select aria-label="Rede"><option value="instagram"${r.rede === "instagram" ? " selected" : ""}>Instagram</option><option value="tiktok"${r.rede === "tiktok" ? " selected" : ""}>TikTok</option></select>
      <input class="r-u" value="${esc(r.usuario)}" aria-label="Usuário"><input class="r-l" value="${esc(r.link)}" aria-label="Link"><button type="button" class="ed-rm" aria-label="Remover">×</button></div>`;
  }
  function linhaCat(c) {
    return `<div class="ed-cat" data-id="${esc(c.id)}"><input class="cat-pt" value="${esc(bil(c.nome, "pt"))}" placeholder="Nome" aria-label="Nome em português"><input class="cat-en" value="${esc(bil(c.nome, "en"))}" placeholder="em inglês" aria-label="Nome em inglês"><button type="button" class="ed-rm" aria-label="Remover">×</button></div>`;
  }

  /* ---------- GitHub: conectar, sincronizar e publicar ---------- */
  function palpiteRepo() {
    const h = location.hostname;
    if (h.endsWith(".github.io")) {
      const dono = h.split(".")[0];
      const seg = location.pathname.split("/").filter(Boolean)[0];
      return { owner: dono, repo: seg && !seg.includes(".") ? seg : h };
    }
    return { owner: "", repo: "" };
  }
  async function api(c, caminho, opcoes = {}) {
    let r;
    try {
      r = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}${caminho}`, {
        ...opcoes,
        headers: { Authorization: `Bearer ${c.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opcoes.body ? { "Content-Type": "application/json" } : {}) }
      });
    } catch (e) { throw new Error("Sem conexão com o GitHub. Verifique a internet. (Na prévia do Claude a publicação não funciona: use o site publicado.)"); }
    if (r.status === 401) throw new Error("O token não é válido ou expirou. Crie um novo token e conecte de novo.");
    if (r.status === 403) throw new Error("O token não tem permissão para gravar neste repositório. Confira se marcou Contents: Read and write.");
    if (r.status === 404) throw new Error("Repositório não encontrado. Confira o usuário e o nome do repositório, e se o token tem acesso a ele.");
    if (!r.ok) throw new Error(`O GitHub recusou a operação (erro ${r.status}). Tente de novo em instantes.`);
    return r.json();
  }
  async function lerRepo(c) {
    const ref = await api(c, `/git/ref/heads/${encodeURIComponent(c.branch)}`);
    const commit = await api(c, `/git/commits/${ref.object.sha}`);
    const arvore = await api(c, `/git/trees/${commit.tree.sha}?recursive=1`);
    const caminhos = new Map(arvore.tree.map((x) => [x.path, x.sha]));
    const achado = [...caminhos.keys()].find((p) => /(^|\/)conteudo\.js$/.test(p) && (caminhos.has(p.replace(/conteudo\.js$/, "main.js")) || caminhos.has(p.replace(/conteudo\.js$/, "js/main.js"))));
    if (achado == null) throw new Error("Não encontrei o arquivo conteudo.js neste repositório. Confira se enviou os arquivos do site.");
    return { sha: ref.object.sha, arvore: commit.tree.sha, caminhos, prefixo: achado.replace(/conteudo\.js$/, "") };
  }
  const lerConteudo = (txt) => JSON.parse(txt.slice(txt.indexOf("{", txt.indexOf("window.CONTEUDO")), txt.lastIndexOf("}") + 1));
  async function sincronizar(c) {
    const repo = await lerRepo(c);
    const blob = await api(c, `/git/blobs/${repo.caminhos.get(repo.prefixo + "conteudo.js")}`);
    const bytes = Uint8Array.from(atob(blob.content.replace(/\n/g, "")), (ch) => ch.charCodeAt(0));
    const remoto = lerConteudo(new TextDecoder().decode(bytes));
    if (JSON.stringify(remoto) !== original && !alterado()) {
      substituir(remoto); original = JSON.stringify(C); atualizar();
      aviso("Carreguei a versão mais recente do seu site.");
    }
  }
  const paraBase64 = (blob) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = erro; r.readAsDataURL(blob); });
  const caminhosMidia = (txt) => new Set((txt.match(/"[^"\/:]+\.(?:jpe?g|png|webp|mp4|webm|mov)"/gi) || []).map((s) => s.slice(1, -1)));

  async function publicar() {
    if (!alterado()) return aviso("Nada novo para publicar.");
    if (!cred?.token) return painelConectar(true);
    const botao = $("#ed-publicar");
    botao.disabled = true;
    try {
      botao.textContent = "Conectando…";
      const repo = await lerRepo(cred);
      const atual = JSON.stringify(C);
      const usados = caminhosMidia(atual);
      const itens = [];
      const envios = [...fila].filter(([p]) => usados.has(p));
      let n = 0;
      for (const [p, blob] of envios) {
        botao.textContent = `Enviando ${++n} de ${envios.length}…`;
        const r = await api(cred, "/git/blobs", { method: "POST", body: JSON.stringify({ content: await paraBase64(blob), encoding: "base64" }) });
        itens.push({ path: repo.prefixo + p, mode: "100644", type: "blob", sha: r.sha });
      }
      const fonte = await fetch("conteudo.js", { cache: "no-store" }).then((r) => r.text()).catch(() => "");
      const cabecalho = fonte.includes("window.CONTEUDO") ? fonte.slice(0, fonte.indexOf("window.CONTEUDO")) : "";
      itens.push({ path: repo.prefixo + "conteudo.js", mode: "100644", type: "blob", content: cabecalho + "window.CONTEUDO = " + JSON.stringify(C, null, 2) + ";\n" });
      for (const p of caminhosMidia(original)) {
        if (!usados.has(p) && repo.caminhos.has(repo.prefixo + p)) itens.push({ path: repo.prefixo + p, mode: "100644", type: "blob", sha: null });
      }
      botao.textContent = "Publicando…";
      const arvore = await api(cred, "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: repo.arvore, tree: itens }) });
      const commit = await api(cred, "/git/commits", { method: "POST", body: JSON.stringify({ message: "Atualiza portfólio pelo editor", tree: arvore.sha, parents: [repo.sha] }) });
      await api(cred, `/git/refs/heads/${encodeURIComponent(cred.branch)}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
      original = atual; fila.clear();
      aviso("Publicado! O site no ar se atualiza em 1 a 2 minutos.", "ok");
    } catch (e) {
      aviso(e.message, "erro");
    } finally {
      botao.disabled = false; barra();
    }
  }
  $("#ed-publicar").onclick = publicar;

  function painelConectar(publicarDepois) {
    const p = { ...palpiteRepo(), branch: "main", ...(cred || {}) };
    abrirPainel("Conectar ao GitHub", `
      <p class="ed-nota">Só na primeira vez neste navegador. Os dados ficam salvos apenas aqui, no seu aparelho.</p>
      <label>Seu usuário no GitHub<input id="ed-g-owner" value="${esc(p.owner)}" autocomplete="username"></label>
      <label>Nome do repositório<input id="ed-g-repo" value="${esc(p.repo)}"></label>
      <label>Branch<input id="ed-g-branch" value="${esc(p.branch)}"></label>
      <label>Token de acesso<input id="ed-g-token" type="password" value="${esc(p.token || "")}" autocomplete="off" placeholder="github_pat_…"></label>
      <details class="ed-ajuda"><summary>Como criar o token</summary><ol>
        <li>Abra <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a>.</li>
        <li>Nome: <b>Editor do portfólio</b>. Validade: até 1 ano.</li>
        <li>Em <b>Repository access</b>, escolha <b>Only select repositories</b> e marque o repositório do site.</li>
        <li>Em <b>Permissions → Repository permissions</b>, mude <b>Contents</b> para <b>Read and write</b>.</li>
        <li>Clique em <b>Generate token</b>, copie o código e cole aqui.</li></ol></details>
      <div class="ed-acoes">${cred ? '<button type="button" class="ed-bt ed-bt--fantasma" id="ed-g-sair">Desconectar</button>' : ""}<button type="button" class="ed-bt ed-bt--forte" id="ed-g-ok">${publicarDepois ? "Conectar e publicar" : "Conectar"}</button></div>`, (corpo) => {
      $("#ed-g-ok", corpo).onclick = async () => {
        const c = { owner: $("#ed-g-owner", corpo).value.trim(), repo: $("#ed-g-repo", corpo).value.trim(), branch: $("#ed-g-branch", corpo).value.trim() || "main", token: $("#ed-g-token", corpo).value.trim() };
        if (!c.owner || !c.repo || !c.token) return aviso("Preencha usuário, repositório e token.", "erro");
        $("#ed-g-ok", corpo).disabled = true; $("#ed-g-ok", corpo).textContent = "Testando…";
        try {
          await lerRepo(c);
          cred = c;
          try { localStorage.setItem(CHAVE, JSON.stringify(c)); } catch (e) {}
          fecharPainel(); aviso("Conectado ao GitHub.", "ok");
          if (publicarDepois) publicar(); else sincronizar(c).catch(() => {});
        } catch (e) { aviso(e.message, "erro"); $("#ed-g-ok", corpo).disabled = false; $("#ed-g-ok", corpo).textContent = "Tentar de novo"; }
      };
      $("#ed-g-sair", corpo)?.addEventListener("click", () => { cred = null; try { localStorage.removeItem(CHAVE); } catch (e) {} fecharPainel(); aviso("Desconectado deste navegador."); });
    });
  }
  $(".ed-barra__titulo").onclick = () => painelConectar(false);
  $(".ed-barra__titulo").title = "Conexão com o GitHub";

  /* ---------- início ---------- */
  P.render();
  if (cred?.token) sincronizar(cred).catch((e) => aviso(e.message, "erro"));
})();
