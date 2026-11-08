# Seu portfólio: como publicar e editar

## Parte 1 — Colocar o site no ar (GitHub Pages, grátis)

Faça essa parte **no computador**, uma vez só.

### 1. Crie a conta e o repositório
1. Crie uma conta em **[github.com/signup](https://github.com/signup)**. Anote seu nome de usuário (ex.: `paulagomides`).
2. No canto superior direito, clique em **+ → New repository**.
3. Em **Repository name**, escreva exatamente: `SEU-USUARIO.github.io`
   (ex.: `paulagomides.github.io`). Assim o endereço do site fica `https://paulagomides.github.io`.
4. Deixe marcado **Public** e marque **Add a README file**.
5. Clique em **Create repository**.

### 2. Envie os arquivos do site
1. No seu computador, **descompacte** o arquivo `portfolio-paula-gomides.zip`.
2. Abra a pasta `portfolio-paula-gomides`. Dentro dela você vê `index.html`, `conteudo.js`, as pastas `css`, `js`, `midia` e este guia.
   O pacote tem só uns 2 MB: os vídeos ficam no Cloudinary, não no GitHub.
3. No GitHub, na página do repositório, clique em **Add file → Upload files**.
4. Selecione **tudo o que está dentro da pasta** (Ctrl+A no Windows, Cmd+A no Mac) e **arraste** para a página do GitHub.
   Use Chrome ou Edge: eles mantêm as pastas.
   ⚠️ Arraste o *conteúdo* da pasta, não a pasta inteira. O `index.html` tem que ficar na "raiz" do repositório.
5. Espere todos os arquivos carregarem e clique em **Commit changes**.
6. Confira: a página do repositório deve mostrar `index.html`, `conteudo.js`, `css`, `js` e `midia` logo de cara.

### 3. Ligue o site
1. No repositório, clique em **Settings** (engrenagem) → no menu da esquerda, **Pages**.
2. Em **Source**, escolha **Deploy from a branch**. Em **Branch**, escolha **main** e **/ (root)**. Clique em **Save**.
3. Espere de 1 a 3 minutos e recarregue a página. Vai aparecer **"Your site is live at https://…"**. Pronto, seu site está no ar!

### 4. (Opcional) Endereço próprio, ex.: paulagomides.com.br
1. Registre o domínio no **[registro.br](https://registro.br)** (cerca de R$ 40 por ano).
2. No registro.br, abra o domínio → **DNS** → **Configurar zona DNS** e crie:
   - 4 registros do tipo **A** em `paulagomides.com.br` apontando para:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153` e `185.199.111.153`
   - 1 registro **CNAME** em `www` apontando para `SEU-USUARIO.github.io`
3. No GitHub, em **Settings → Pages → Custom domain**, escreva `paulagomides.com.br` e clique em **Save**.
4. Quando aparecer o visto verde (pode levar algumas horas), marque **Enforce HTTPS**.

---

## Parte 2 — Editar o site direto nele (igual ao Canva)

1. Abra o seu site com **`#editar`** no final do endereço:
   `https://paulagomides.github.io/#editar` (ou `https://paulagomides.com.br/#editar`)
2. Aparece uma barra escura embaixo: você está no **modo edição**. Só você consegue publicar, porque a publicação exige o seu token (passo 4).

### O que dá para fazer
| Quero… | Como |
|---|---|
| Mudar um texto | Clique nele, escreva e aperte **Enter** (ou clique fora). |
| Deixar uma palavra do título em itálico rosa | Escreva entre asteriscos: `na *rotina real*` |
| Editar o texto em inglês | Clique em **EN** no topo e edite. **PT** volta para o português. |
| Adicionar um vídeo | Em Vídeos, clique em **+ Adicionar vídeo** e escolha o arquivo. Ele sobe para o Cloudinary (aparece uma barra de progresso) e a capa é gerada sozinha. Preencha título, categoria e etiquetas e clique em **Adicionar ao portfólio**. |
| Escolher a capa do vídeo | No painel do vídeo, dê play, pause no momento bonito e clique em **Usar o momento atual do vídeo como capa**. |
| Mudar a ordem de vídeos, fotos ou itens | Passe o mouse no item (no celular os botões já aparecem) e use **◀ ▶**. |
| Editar ou apagar um vídeo | **✎ Editar** ou **✕** sobre o vídeo. |
| Adicionar fotos | **+ Adicionar fotos** na galeria (pode escolher várias de uma vez). |
| Trocar a foto da capa ou o vídeo do "Sobre" | Botão **Trocar foto / Trocar vídeo** sobre eles. |
| Mudar a ordem das seções ou esconder uma (ex.: Pacotes) | Botão **Seções** na barra. |
| Adicionar serviço, etapa, pacote, item de pacote… | Botão **+ Adicionar** embaixo de cada lista. |
| Mudar o pacote em destaque | **★** sobre o pacote. |
| WhatsApp, e-mail, redes e categorias | Botão **Contato e categorias**. |
| Errei | **↶ Desfazer** (ou Ctrl+Z). |

3. Quando terminar, clique em **Publicar alterações**. Em 1 ou 2 minutos o site no ar atualiza.
   Até publicar, nada muda para quem visita o site.

### 4. Primeira publicação: conectar ao GitHub (só uma vez por aparelho)
Na primeira vez que clicar em Publicar, o editor pede um **token**. Ele é uma senha que só serve para atualizar este site:
1. Abra **[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)**.
2. **Token name**: `Editor do portfólio`. **Expiration**: escolha 1 ano.
3. **Repository access** → **Only select repositories** → escolha o repositório do site.
4. **Permissions → Repository permissions → Contents** → mude para **Read and write**.
5. Clique em **Generate token**, copie o código (começa com `github_pat_`) e cole no editor.
6. Preencha também seu usuário e o nome do repositório. No endereço `github.io`, eles já vêm preenchidos.

O token fica salvo **só no navegador onde você colou**. Em outro aparelho, cole de novo.
Se perder o celular, apague o token em github.com → Settings → Developer settings → Personal access tokens.

### Onde ficam os vídeos: Cloudinary
Os vídeos ficam guardados na sua conta do **Cloudinary** (cloud name `nkcxrsrx`, preset `portfolio`, pasta `portfolio`).
O Cloudinary converte e comprime cada vídeo sozinho para tocar rápido no celular.
- Limite: **100 MB por vídeo** (plano grátis). Vídeo vertical, sem marca d'água. MP4 ou .mov do iPhone.
- Se passar de 100 MB: no CapCut, exporte em 1080p.
- Apagar um vídeo no editor tira ele do site, mas o arquivo continua no Cloudinary. Para liberar espaço, apague também em cloudinary.com → **Media Library → pasta portfolio**.
- O plano grátis tem uma cota mensal de uso (créditos). Para um portfólio, ela costuma sobrar, mas você acompanha em cloudinary.com → **Dashboard**.
- **Não apague o upload preset `portfolio`**: é ele que permite o editor enviar vídeos.

### Dicas para fotos
- As fotos são redimensionadas automaticamente.
- Na foto da capa, uma imagem **com fundo transparente (PNG)** fica mais bonita. O [remove.bg](https://www.remove.bg) tira o fundo de graça.

---

## Idioma do site
O botão **PT | EN** no topo troca só os textos. Vídeos e fotos são os mesmos.
O site abre em inglês automaticamente para quem tem o navegador em outro idioma.
Para mandar o link já em inglês para uma marca gringa, use: `https://paulagomides.com.br/?lang=en`

## Para quem prefere mexer nos arquivos
Todo o conteúdo fica em `conteudo.js`. Textos com `"pt"` e `"en"` são as duas versões. Mantenha as aspas duplas e as vírgulas.
Depois de editar, envie o arquivo pelo GitHub (**Add file → Upload files**).

## Checklist do guia antes de enviar para marcas
- [ ] Abrir no celular e contar até 5: dá para entender quem você é e o que oferece?
- [ ] Pelo menos 9 vídeos, sem marca d'água, variados.
- [ ] Pacotes revisados (ou escondidos em **Seções**).
- [ ] Botão de WhatsApp testado em outro aparelho, nos dois idiomas.
