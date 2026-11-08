/* Monta o site a partir do conteudo.js. Você não precisa editar este arquivo. */
(function () {
  "use strict";
  const C = window.CONTEUDO;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const flor = '<svg class="flor" viewBox="0 0 100 100" aria-hidden="true"><use href="#flor"/></svg>';
  const icone = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const reduzMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const temHover = matchMedia("(hover: hover)").matches;

  /* ---------- textos fixos da interface ---------- */
  const UI = {
    pt: { pular: "Pular para os vídeos", vamosConversar: "Vamos conversar", verVideos: "Ver vídeos", chamarWhats: "Chamar no WhatsApp",
      enviarEmail: "Enviar e-mail", email: "E-mail", cidade: "Cidade", copiar: "Copiar", copiado: "Copiado!", voltarTopo: "Voltar ao topo ↑",
      todos: "Todos", vazio: "Nenhum vídeo nesta categoria ainda.", assistir: "Assistir", ampliar: "Ampliar foto", contato: "Contato",
      abrirMenu: "Abrir menu", fecharMenu: "Fechar menu", assunto: "Parceria UGC", fechar: "Fechar", anterior: "Anterior", proximo: "Próximo",
      pacoteMsg: "Olá, Paula! Vi seu portfólio e tenho interesse no pacote {p}.", filtrar: "Filtrar vídeos por nicho" },
    en: { pular: "Skip to videos", vamosConversar: "Let’s talk", verVideos: "Watch videos", chamarWhats: "Message on WhatsApp",
      enviarEmail: "Send an email", email: "Email", cidade: "City", copiar: "Copy", copiado: "Copied!", voltarTopo: "Back to top ↑",
      todos: "All", vazio: "No videos in this category yet.", assistir: "Watch", ampliar: "Enlarge photo", contato: "Contact",
      abrirMenu: "Open menu", fecharMenu: "Close menu", assunto: "UGC partnership", fechar: "Close", anterior: "Previous", proximo: "Next",
      pacoteMsg: "Hi Paula! I saw your portfolio and I’m interested in the {p} package.", filtrar: "Filter videos by niche" }
  };

  /* ---------- idioma ---------- */
  function idiomaInicial() {
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "en" || q === "pt") return q;
    try { const s = localStorage.getItem("idioma"); if (s === "en" || s === "pt") return s; } catch (e) {}
    return /^pt/i.test(navigator.language || "pt") ? "pt" : "en";
  }
  const P = (window.Portfolio = { C, lang: idiomaInicial(), pendentes: {}, editando: false });
  const ui = (k) => UI[P.lang][k] ?? UI.pt[k] ?? k;
  const ehBilingue = (v) => v && typeof v === "object" && !Array.isArray(v) && ("pt" in v || "en" in v);
  const t = (v) => (ehBilingue(v) ? (v[P.lang] ?? "") || v.pt || v.en || "" : v ?? "");
  const rico = (s) => esc(s).replace(/\*(.+?)\*/g, "<em>$1</em>");
  const pegar = (caminho) => caminho.split(".").reduce((o, k) => (o == null ? o : o[k]), C);
  const src = (p) => P.pendentes[p] || p;
  Object.assign(P, { t, ui, rico, pegar, src, esc, ehBilingue });

  /* ---------- montagem ---------- */
  const nomeCat = () => Object.fromEntries(C.categorias.map((c) => [c.id, t(c.nome)]));
  let filtro = "todos";
  try { filtro = sessionStorage.getItem("filtro") || "todos"; } catch (e) {}
  let visiveis = [];
  const linkWhats = (msg) => `https://wa.me/${C.contato.whatsapp}?text=${encodeURIComponent(msg || t(C.contato.mensagemWhatsapp))}`;

  function render() {
    document.documentElement.lang = P.lang === "en" ? "en" : "pt-BR";
    $$(".idioma button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === P.lang));

    // textos com data-e (vêm do conteudo.js) e data-ui (interface)
    $$("[data-e]").forEach((el) => {
      if (el === document.activeElement && el.isContentEditable) return;
      const v = t(pegar(el.dataset.e));
      if (el.dataset.tipo === "nome") {
        const [a, ...r] = String(v).split(" ");
        el.innerHTML = `<span>${esc(a)}</span> <span>${esc(r.join(" "))}</span>`;
      } else if ("rico" in el.dataset) el.innerHTML = rico(v);
      else el.textContent = v;
    });
    $$("[data-ui]").forEach((el) => (el.textContent = ui(el.dataset.ui)));
    $$(".marca__nome").forEach((el) => (el.textContent = C.perfil.nome));
    $("#ano").textContent = new Date().getFullYear();
    $("#foto-capa").src = src(C.perfil.fotoCapa);
    $("#foto-capa").alt = C.perfil.nome;

    // contato
    $$("[data-whats]").forEach((a) => (a.href = linkWhats()));
    $("#link-email").href = `mailto:${C.contato.email}?subject=${encodeURIComponent(ui("assunto"))}`;
    $("#email-texto").textContent = C.contato.email;
    const redes = C.contato.redes.map((r) => `<a href="${esc(r.link)}" target="_blank" rel="noopener">${icone(r.rede)} ${esc(r.usuario)}</a>`);
    $("#capa-redes").innerHTML = redes.map((r) => `<li>${r}</li>`).join("");
    $("#contato-redes").innerHTML = redes.map((r) => `<li>${r}</li>`).join("");
    $("#gaveta-redes").innerHTML = redes.join("");

    // seções: ordem, visibilidade e menu
    const main = $("#principal"), contato = $("#contato");
    const ativas = [];
    C.secoes.forEach((s) => {
      const el = document.getElementById(s.id);
      if (!el) return;
      main.insertBefore(el, contato);
      el.hidden = !s.visivel;
      if (s.visivel) ativas.push({ id: s.id, nome: t(s.nome) });
    });
    ativas.push({ id: "contato", nome: ui("contato") });
    $("#menu").innerHTML = ativas.map((s) => `<a href="#${s.id}">${esc(s.nome)}</a>`).join("") + '<span class="menu__marcador" aria-hidden="true"></span>';
    $("#gaveta-menu").innerHTML = ativas.map((s, i) => `<a href="#${s.id}" style="--i:${i}"><small>${String(i + 1).padStart(2, "0")}</small> ${esc(s.nome)}</a>`).join("");
    $("#hamburguer").setAttribute("aria-label", ui($("#gaveta").hidden ? "abrirMenu" : "fecharMenu"));

    // fita
    const palavras = [esc(t(C.textos.fitaInicio)), ...C.categorias.map((c) => `<b>${esc(t(c.nome))}</b>`), esc(t(C.textos.fitaFim))];
    $("#fita").innerHTML = `<span>${palavras.map((p) => `${p} ${flor}`).join(" ")}</span>`.repeat(4);

    // sobre
    const vs = $("#video-sobre"), vsrc = src(C.perfil.videoSobre);
    if (vs.dataset.src !== vsrc) {
      vs.dataset.src = vsrc; vs.poster = src(C.perfil.capaVideoSobre || ""); vs.src = vsrc;
      if (reduzMovimento) vs.removeAttribute("autoplay"); else vs.play?.().catch(() => {});
    }
    $("#fatos").innerHTML = C.perfil.fatos.map((f, i) => `<li data-item="perfil.fatos.${i}"><span data-e="perfil.fatos.${i}">${esc(t(f))}</span></li>`).join("");
    $("#interesses").innerHTML = C.perfil.interesses.map((f, i) => `<li data-item="perfil.interesses.${i}"><span data-e="perfil.interesses.${i}">${esc(t(f))}</span></li>`).join("");
    $("#diferenciais").innerHTML = C.perfil.diferenciais.map((d, i) =>
      `<div data-item="perfil.diferenciais.${i}"><h3>${flor}<span data-e="perfil.diferenciais.${i}.titulo">${esc(t(d.titulo))}</span></h3><p data-e="perfil.diferenciais.${i}.texto">${esc(t(d.texto))}</p></div>`).join("");

    renderFiltros();
    renderVideos();

    // fotos
    $("#grade-fotos").innerHTML = C.fotos.map((f, i) =>
      `<li data-item="fotos.${i}"><button type="button" data-foto="${i}" aria-label="${esc(ui("ampliar"))}: ${esc(t(f.descricao))}"><img src="${esc(src(f.arquivo))}" alt="${esc(t(f.descricao))}" loading="lazy" decoding="async"></button></li>`).join("");

    // serviços, processo, pacotes
    $("#lista-servicos").innerHTML = C.servicos.map((s, i) =>
      `<li data-item="servicos.${i}">${flor}<h3 data-e="servicos.${i}.nome">${esc(t(s.nome))}</h3><p data-e="servicos.${i}.texto">${esc(t(s.texto))}</p></li>`).join("");
    $("#processo").innerHTML = C.processo.map((p, i) =>
      `<li data-item="processo.${i}"><h4 data-e="processo.${i}.etapa">${esc(t(p.etapa))}</h4><p data-e="processo.${i}.texto">${esc(t(p.texto))}</p></li>`).join("");
    $("#grade-pacotes").innerHTML = C.pacotes.map((p, i) => `
      <article class="pacote${p.destaque ? " pacote--destaque" : ""}" data-item="pacotes.${i}">
        ${p.destaque ? `<span class="pacote__selo" data-e="textos.pacoteDestaqueSelo">${esc(t(C.textos.pacoteDestaqueSelo))}</span>` : ""}
        <h3 data-e="pacotes.${i}.nome">${esc(t(p.nome))}</h3>
        <p class="pacote__preco" data-e="pacotes.${i}.preco">${esc(t(p.preco))}</p>
        <ul data-lista="pacotes.${i}.itens">${p.itens.map((it, j) => `<li data-item="pacotes.${i}.itens.${j}">${flor}<span data-e="pacotes.${i}.itens.${j}">${esc(t(it))}</span></li>`).join("")}</ul>
        <a class="botao" target="_blank" rel="noopener" href="${linkWhats(ui("pacoteMsg").replace("{p}", t(p.nome)))}"><span data-e="textos.pacoteBotao">${esc(t(C.textos.pacoteBotao))}</span></a>
      </article>`).join("");

    aoRolar();
    requestAnimationFrame(() => { const a = $("#menu a.ativo") || null; marcar(a ? a.getAttribute("href").slice(1) : idAtual); });
    P.depoisRender?.();
  }

  function renderFiltros() {
    const conta = (id) => (id === "todos" ? C.videos.length : C.videos.filter((v) => v.categoria === id).length);
    if (filtro !== "todos" && !conta(filtro)) filtro = "todos";
    const itens = [{ id: "todos", nome: ui("todos") }, ...C.categorias.map((c) => ({ id: c.id, nome: t(c.nome) }))].filter((c) => conta(c.id) > 0);
    $("#filtros").setAttribute("aria-label", ui("filtrar"));
    $("#filtros").innerHTML = itens.map((c) =>
      `<button class="filtro" role="tab" type="button" id="filtro-${esc(c.id)}" data-filtro="${esc(c.id)}" aria-selected="${c.id === filtro}" aria-controls="grade-videos">${esc(c.nome)} <small>${conta(c.id)}</small></button>`
    ).join("");
  }

  function renderVideos() {
    const cats = nomeCat();
    visiveis = C.videos.map((v, indice) => ({ v, indice })).filter(({ v }) => filtro === "todos" || v.categoria === filtro);
    const g = $("#grade-videos");
    if (!visiveis.length) { g.innerHTML = `<li class="grade-vazia">${esc(ui("vazio"))}</li>`; P.depoisVideos?.(); return; }
    g.innerHTML = visiveis.map(({ v, indice }, i) => {
      const tags = (v.etiquetas || []).map((e) => { const s = t(e); return `<span class="etiqueta${/ingl|english/i.test(s) ? " etiqueta--en" : ""}">${esc(s)}</span>`; }).join("");
      const sub = [cats[v.categoria], t(v.formato)].filter(Boolean).join(" · ");
      return `<li class="card-video" style="--i:${i}" data-item="videos.${indice}">
        <button type="button" data-indice="${i}" aria-label="${esc(ui("assistir"))}: ${esc(t(v.titulo))}">
          <img src="${esc(src(v.capa))}" alt="" loading="lazy" decoding="async">
          <div class="card-video__sombra"></div>
          <div class="etiquetas">${tags}</div>
          <span class="card-video__play"><svg viewBox="0 0 24 24"><path d="M6 4l15 8-15 8z"/></svg></span>
          <div class="card-video__info"><h3>${esc(t(v.titulo))}</h3><p>${esc(sub)}</p></div>
        </button></li>`;
    }).join("");
    P.depoisVideos?.();
  }
  Object.assign(P, { render, renderVideos });

  P.mudarIdioma = (l) => {
    P.lang = l;
    try { localStorage.setItem("idioma", l); } catch (e) {}
    render();
    if (!modal.hidden) mostrar();
  };
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-lang]"); if (b) P.mudarIdioma(b.dataset.lang); });

  /* ---------- interações (ligadas uma vez só) ---------- */
  $("#copiar-email").addEventListener("click", (e) => {
    const b = e.currentTarget;
    const ok = () => { b.textContent = ui("copiado"); setTimeout(() => (b.textContent = ui("copiar")), 1800); };
    (navigator.clipboard ? navigator.clipboard.writeText(C.contato.email) : Promise.reject()).then(ok, () => {
      const r = document.createRange(); r.selectNodeContents($("#email-texto"));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    });
  });

  $("#filtros").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filtro]");
    if (!b || b.dataset.filtro === filtro) return;
    filtro = b.dataset.filtro;
    try { sessionStorage.setItem("filtro", filtro); } catch (e2) {}
    $$(".filtro").forEach((x) => x.setAttribute("aria-selected", x === b));
    renderVideos();
  });
  $("#filtros").addEventListener("keydown", (e) => {
    if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
    const bs = $$(".filtro"); const i = bs.indexOf(document.activeElement);
    const n = bs[(i + (e.key === "ArrowRight" ? 1 : -1) + bs.length) % bs.length]; n.focus(); n.click();
  });

  // prévia sem som ao passar o mouse
  if (temHover && !reduzMovimento) {
    const g = $("#grade-videos");
    g.addEventListener("mouseover", (e) => {
      if (P.editando) return;
      const card = e.target.closest(".card-video");
      if (!card || card.classList.contains("tocando")) return;
      const item = visiveis[+card.querySelector("[data-indice]").dataset.indice];
      let vid = card.querySelector("video");
      if (!vid) {
        vid = document.createElement("video");
        Object.assign(vid, { src: src(item.v.video), muted: true, loop: true, playsInline: true, preload: "auto" });
        card.querySelector("img").after(vid);
      }
      card.classList.add("tocando");
      vid.play().catch(() => {});
    });
    g.addEventListener("mouseout", (e) => {
      const card = e.target.closest(".card-video");
      if (!card || card.contains(e.relatedTarget)) return;
      card.classList.remove("tocando");
      card.querySelector("video")?.pause();
    });
  }
  $("#grade-videos").addEventListener("click", (e) => {
    if (P.editando) return;
    const b = e.target.closest("[data-indice]");
    if (b) abrir("video", +b.dataset.indice);
  });
  $("#grade-fotos").addEventListener("click", (e) => {
    if (P.editando) return;
    const b = e.target.closest("[data-foto]");
    if (b) abrir("foto", +b.dataset.foto);
  });

  /* ---------- menu: rolagem, item ativo, celular ---------- */
  const topo = $("#topo");
  const flutuante = $(".whats-flutuante");
  function aoRolar() {
    topo.classList.toggle("rolou", scrollY > 10);
    flutuante.classList.toggle("visivel", !P.editando && scrollY > innerHeight * 0.8 && scrollY + innerHeight < document.documentElement.scrollHeight - 400);
  }
  addEventListener("scroll", aoRolar, { passive: true });

  let idAtual = null;
  function marcar(id) {
    idAtual = id;
    const marcador = $(".menu__marcador");
    let ativo = null;
    $$("#menu a").forEach((a) => { const on = a.getAttribute("href") === "#" + id; a.classList.toggle("ativo", on); if (on) ativo = a; });
    $$("#gaveta a").forEach((a) => a.toggleAttribute("aria-current", a.getAttribute("href") === "#" + id));
    if (!marcador) return;
    if (ativo) {
      marcador.style.width = ativo.offsetWidth + "px";
      marcador.style.transform = `translateX(${ativo.offsetLeft}px)`;
      marcador.style.opacity = 1;
    } else marcador.style.opacity = 0;
  }
  const obs = new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting) marcar(en.target.id); });
  }, { rootMargin: "-45% 0px -50% 0px" });
  $$("main section[id]").forEach((s) => obs.observe(s));
  addEventListener("resize", () => marcar(idAtual));

  const ham = $("#hamburguer"), gaveta = $("#gaveta");
  function alternarMenu(abrirMenu) {
    gaveta.hidden = !abrirMenu;
    ham.setAttribute("aria-expanded", abrirMenu);
    ham.setAttribute("aria-label", ui(abrirMenu ? "fecharMenu" : "abrirMenu"));
    document.body.classList.toggle("menu-aberto", abrirMenu);
  }
  ham.addEventListener("click", () => alternarMenu(gaveta.hidden));
  gaveta.addEventListener("click", (e) => { if (e.target.closest("a")) alternarMenu(false); });

  /* ---------- visualizador (vídeo com som / foto ampliada) ---------- */
  const modal = $("#modal"), palco = $("#modal-midia"), legenda = $("#modal-legenda");
  let atual = { tipo: null, i: 0 }, focoAnterior = null;

  function mostrar() {
    $("#modal-fechar").setAttribute("aria-label", ui("fechar"));
    $("#modal-ant").setAttribute("aria-label", ui("anterior"));
    $("#modal-prox").setAttribute("aria-label", ui("proximo"));
    const lista = atual.tipo === "video" ? visiveis.map((x) => x.v) : C.fotos;
    const item = lista[atual.i];
    if (!item) return fechar();
    if (atual.tipo === "video") {
      const jaTocando = palco.querySelector("video")?.dataset.src === item.video;
      if (!jaTocando) {
        palco.innerHTML = `<video src="${esc(src(item.video))}" data-src="${esc(item.video)}" poster="${esc(src(item.capa))}" controls autoplay playsinline></video>`;
        palco.querySelector("video").play().catch(() => {});
      }
      const sub = [nomeCat()[item.categoria], t(item.formato), ...(item.etiquetas || []).map(t)].filter(Boolean).join(" · ");
      legenda.innerHTML = `<strong>${esc(t(item.titulo))}</strong><span>${esc(sub)}</span>`;
    } else {
      palco.innerHTML = `<img src="${esc(src(item.arquivo))}" alt="${esc(t(item.descricao))}">`;
      legenda.innerHTML = `<span>${atual.i + 1} / ${C.fotos.length}</span>`;
    }
    $("#modal-ant").hidden = $("#modal-prox").hidden = lista.length < 2;
  }
  function abrir(tipo, i) {
    focoAnterior = document.activeElement;
    atual = { tipo, i };
    $$(".card-video video").forEach((v) => v.pause());
    modal.hidden = false; document.body.style.overflow = "hidden";
    mostrar(); $("#modal-fechar").focus();
  }
  function fechar() {
    modal.hidden = true; palco.innerHTML = ""; document.body.style.overflow = "";
    focoAnterior?.focus();
  }
  function passo(d) {
    const n = atual.tipo === "video" ? visiveis.length : C.fotos.length;
    atual.i = (atual.i + d + n) % n; palco.innerHTML = ""; mostrar();
  }
  $("#modal-fechar").addEventListener("click", fechar);
  $("#modal-ant").addEventListener("click", () => passo(-1));
  $("#modal-prox").addEventListener("click", () => passo(1));
  modal.addEventListener("click", (e) => { if (e.target === modal || e.target === palco || e.target.classList.contains("modal__palco")) fechar(); });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !gaveta.hidden) alternarMenu(false);
    if (modal.hidden) return;
    if (e.key === "Escape") fechar();
    if (e.key === "ArrowRight") passo(1);
    if (e.key === "ArrowLeft") passo(-1);
    if (e.key === "Tab") {
      const f = $$("button:not([hidden]), video", modal); const pri = f[0], ult = f[f.length - 1];
      if (e.shiftKey && document.activeElement === pri) { e.preventDefault(); ult.focus(); }
      else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
    }
  });
  let toqueX = null;
  modal.addEventListener("touchstart", (e) => (toqueX = e.target.tagName === "VIDEO" ? null : e.touches[0].clientX), { passive: true });
  modal.addEventListener("touchend", (e) => {
    if (toqueX == null) return;
    const dx = e.changedTouches[0].clientX - toqueX; toqueX = null;
    if (Math.abs(dx) > 60) passo(dx < 0 ? 1 : -1);
  });

  render();
})();
