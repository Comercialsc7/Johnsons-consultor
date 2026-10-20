"""Consultor comercial SC Johnson: catálogo, embalagem e prazo."""

from __future__ import annotations

import html
import io
import pickle
import tempfile
from pathlib import Path

import pandas as pd
import streamlit as st

from catalogo import (
    filtrar_produtos,
    ler_catalogo,
    linha_curta,
    moeda,
    ordenar_embalagens,
    resumir_produtos,
    rotulo_embalagem,
)

RAIZ = Path(__file__).resolve().parent
LOGO = RAIZ / "assets" / "scj_logo.svg"
CACHE_CATALOGO = Path(tempfile.gettempdir()) / "johnsons_consultor_catalogo.pkl"

PRAZOS = (
    ("avista", "À vista"),
    ("d7", "7 dias"),
    ("d14", "14 dias"),
    ("d21", "21 dias"),
    ("d28", "28 dias"),
)

ESTILO = """
<style>
  html, body, [class*="css"] {
    font-family: "Segoe UI", "Helvetica Neue", sans-serif;
  }
  .stApp { background: #F3F0EB; }
  header[data-testid="stHeader"], .stAppHeader {
    background: transparent;
    pointer-events: none;
  }
  #MainMenu, footer, [data-testid="stToolbar"], [data-testid="stDecoration"] { visibility: hidden; }
  .block-container {
    max-width: 1080px;
    padding-top: 1.4rem;
    padding-bottom: 3rem;
  }
  .hero-kicker {
    margin: 22px 0 0;
    color: #DF2626;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .hero-title {
    margin: 6px 0 0;
    color: #1A1A1A;
    font-size: 40px;
    line-height: 1.1;
    font-weight: 650;
    letter-spacing: -0.03em;
  }
  .hero-text {
    margin: 12px 0 22px;
    color: #5E5852;
    font-size: 17px;
    line-height: 1.45;
  }
  .logo svg { display: block; }
  .sku-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 12px;
    margin-top: 8px;
  }
  a.sku-card {
    display: flex;
    flex-direction: column;
    min-height: 132px;
    padding: 16px 16px 14px;
    background: #FFFFFF;
    border: 1px solid #E4DDD4;
    border-radius: 14px;
    color: #1A1A1A;
    text-decoration: none;
  }
  a.sku-card:hover { border-color: #DF2626; }
  .sku-top {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: baseline;
  }
  .sku-cat {
    color: #DF2626;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .sku-cod {
    color: #8A837C;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .sku-nome {
    margin-top: 8px;
    font-size: 15px;
    font-weight: 650;
    line-height: 1.35;
  }
  .sku-sub {
    margin-top: auto;
    padding-top: 12px;
    color: #6B6560;
    font-size: 13px;
  }
  .prod-kicker {
    margin: 0;
    color: #DF2626;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .prod-title {
    margin: 4px 0 0;
    color: #1A1A1A;
    font-size: 30px;
    line-height: 1.2;
    font-weight: 650;
    letter-spacing: -0.02em;
  }
  .prod-meta {
    margin: 8px 0 0;
    color: #6B6560;
    font-size: 14px;
  }
  .unitario-nota {
    margin: 20px 0 0;
    color: #6B6560;
    font-size: 14px;
  }
  .tabela-wrap {
    margin-top: 14px;
    background: #FFFFFF;
    border: 1px solid #E4DDD4;
    border-radius: 14px;
    overflow-x: auto;
  }
  table.precos {
    width: 100%;
    border-collapse: collapse;
  }
  table.precos th {
    text-align: left;
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #6B6560;
    background: #FAF8F6;
    padding: 12px 14px;
    border-bottom: 1px solid #E4DDD4;
  }
  table.precos td {
    padding: 14px;
    border-bottom: 1px solid #EFEAE4;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
    color: #1A1A1A;
  }
  table.precos tr:last-child td { border-bottom: none; }
  table.precos .num {
    text-align: right;
    white-space: nowrap;
  }
  table.precos .emb { font-weight: 650; }
  table.precos .sigla {
    display: block;
    margin-top: 2px;
    color: #8A837C;
    font-size: 12px;
    font-weight: 500;
  }
  .vazio {
    margin-top: 28px;
    padding: 28px 8px;
    color: #6B6560;
    text-align: center;
  }
  [class*="st-key-abrir_"] button {
    background: transparent;
    border: none;
    color: #1A1A1A;
    justify-content: flex-start;
    text-align: left;
    height: auto;
    min-height: 0;
    padding: 6px 0 2px;
    white-space: normal;
  }
  [class*="st-key-abrir_"] button:hover {
    background: transparent;
    border: none;
    color: #DF2626;
  }
  [class*="st-key-abrir_"] button p {
    white-space: normal;
    text-align: left;
    font-weight: 650;
    font-size: 15px;
    line-height: 1.35;
  }
</style>
"""


def garantir_estado() -> None:
    st.session_state.setdefault("tela", "boas_vindas")
    st.session_state.setdefault("catalogo", None)
    st.session_state.setdefault("arquivo_nome", "")
    st.session_state.setdefault("cod_sel", None)
    st.session_state.setdefault("busca_salva", "")
    st.session_state.setdefault("linha_salva", "Todas as linhas")
    if st.session_state.pop("limpar_filtros", False):
        st.session_state.busca = ""
        st.session_state.linha = "Todas as linhas"
        st.session_state.busca_salva = ""
        st.session_state.linha_salva = "Todas as linhas"


def aplicar_estilo() -> None:
    st.markdown(ESTILO, unsafe_allow_html=True)


def logo_html(largura: int) -> str:
    if not LOGO.exists():
        return (
            "<div class='logo' style='color:#DF2626;font-weight:700;"
            "font-size:28px;letter-spacing:-0.03em;'>SC Johnson</div>"
        )
    svg = LOGO.read_text(encoding="utf-8")
    altura = round(largura * 48 / 146)
    svg = svg.replace('width="146"', f'width="{largura}"', 1)
    svg = svg.replace('height="48"', f'height="{altura}"', 1)
    return f"<div class='logo'>{svg}</div>"


def _limpar_previa() -> None:
    st.session_state.pop("_previa", None)
    st.session_state.pop("_previa_nome", None)


@st.dialog("Importar catálogo", width="medium", on_dismiss=_limpar_previa)
def modal_importar() -> None:
    st.markdown(
        "Envie a planilha de preços com produto, embalagem, quantidade "
        "e os prazos à vista, 7, 14, 21 e 28 dias."
    )
    arquivo = st.file_uploader(
        "Planilha de preços",
        type=["xlsx"],
        label_visibility="collapsed",
    )
    if arquivo is None:
        _limpar_previa()
    else:
        try:
            previa = ler_catalogo(io.BytesIO(arquivo.getvalue()))
            produtos = int(previa["cod"].nunique())
            st.session_state["_previa"] = previa
            st.session_state["_previa_nome"] = arquivo.name
            st.markdown(
                f"**{produtos} produtos** · {len(previa)} embalagens em `{arquivo.name}`."
            )
        except Exception as erro:
            _limpar_previa()
            st.error(str(erro))

    pronto = isinstance(st.session_state.get("_previa"), pd.DataFrame)
    if st.button(
        "Carregar catálogo",
        type="primary",
        disabled=not pronto,
        use_container_width=True,
    ):
        st.session_state.catalogo = st.session_state.pop("_previa")
        st.session_state.arquivo_nome = st.session_state.pop("_previa_nome", "")
        st.session_state.cod_sel = None
        st.session_state.tela = "catalogo"
        st.session_state.limpar_filtros = True
        _salvar_cache()
        st.rerun()


def _salvar_cache() -> None:
    catalogo = st.session_state.catalogo
    if not isinstance(catalogo, pd.DataFrame):
        return
    pacote = {
        "catalogo": catalogo,
        "arquivo_nome": st.session_state.arquivo_nome,
        "busca_salva": st.session_state.get("busca_salva", ""),
        "linha_salva": st.session_state.get("linha_salva", "Todas as linhas"),
    }
    CACHE_CATALOGO.write_bytes(pickle.dumps(pacote))


def _restaurar_cache() -> bool:
    if not CACHE_CATALOGO.exists():
        return False
    try:
        pacote = pickle.loads(CACHE_CATALOGO.read_bytes())
    except (OSError, pickle.UnpicklingError, EOFError):
        return False
    catalogo = pacote.get("catalogo")
    if not isinstance(catalogo, pd.DataFrame) or catalogo.empty:
        return False
    st.session_state.catalogo = catalogo
    st.session_state.arquivo_nome = pacote.get("arquivo_nome", "")
    st.session_state.busca_salva = pacote.get("busca_salva", "")
    st.session_state.linha_salva = pacote.get("linha_salva", "Todas as linhas")
    return True


def _abrir_produto(codigo: str) -> None:
    st.session_state.cod_sel = str(codigo)
    st.session_state.tela = "detalhe"


def redirecionar_sku() -> None:
    sku = st.query_params.get("sku")
    if not sku:
        return
    if not isinstance(st.session_state.catalogo, pd.DataFrame) and not _restaurar_cache():
        return
    st.session_state.cod_sel = str(sku)
    st.session_state.tela = "detalhe"
    del st.query_params["sku"]
    st.rerun()


def tela_boas_vindas() -> None:
    st.markdown("<div style='height:9vh'></div>", unsafe_allow_html=True)
    _, meio, _ = st.columns([1, 1.15, 1])
    with meio:
        st.markdown(logo_html(300), unsafe_allow_html=True)
        st.markdown("<p class='hero-kicker'>Condições comerciais</p>", unsafe_allow_html=True)
        st.markdown("<h1 class='hero-title'>Consultor comercial</h1>", unsafe_allow_html=True)
        st.markdown(
            "<p class='hero-text'>Importe a planilha para consultar produto, "
            "embalagem e preço por prazo. A busca fica disponível na tela seguinte.</p>",
            unsafe_allow_html=True,
        )
        if st.button("Importar catálogo", type="primary", use_container_width=True):
            modal_importar()
        if st.session_state.catalogo is not None:
            st.write("")
            if st.button("Continuar no catálogo", use_container_width=True):
                st.session_state.tela = "catalogo"
                st.rerun()


def _render_card(linha) -> None:
    codigo = str(int(linha.cod))
    categoria = html.escape(linha_curta(linha.categoria1))
    n_emb = int(linha.n_emb)
    embalagens = "1 embalagem" if n_emb == 1 else f"{n_emb} embalagens"
    with st.container(border=True):
        st.markdown(
            "<div class='sku-top'>"
            f"<span class='sku-cod'>{html.escape(codigo)}</span>"
            f"<span class='sku-cat'>{categoria}</span>"
            "</div>",
            unsafe_allow_html=True,
        )
        if st.button(
            str(linha.produto),
            key=f"abrir_{codigo}",
            use_container_width=True,
            on_click=_abrir_produto,
            args=(codigo,),
        ):
            st.rerun()
        st.markdown(
            f"<div class='sku-sub'>{embalagens} · unid. a partir de {moeda(linha.preco_uni_min)}</div>",
            unsafe_allow_html=True,
        )


def tela_catalogo() -> None:
    catalogo = st.session_state.catalogo
    resumo = resumir_produtos(catalogo)
    if "busca" not in st.session_state:
        st.session_state.busca = st.session_state.busca_salva
    if "linha" not in st.session_state:
        st.session_state.linha = st.session_state.linha_salva
    st.markdown(logo_html(168), unsafe_allow_html=True)
    st.write("")
    busca_col, acao = st.columns([5.2, 1.45], vertical_alignment="bottom")
    with busca_col:
        st.text_input(
            "Buscar produto",
            key="busca",
            placeholder="Buscar por código ou nome",
            label_visibility="collapsed",
        )
    with acao:
        if st.button("Trocar arquivo", use_container_width=True):
            modal_importar()

    linhas = ["Todas as linhas"] + sorted(resumo["categoria1"].dropna().unique())
    if st.session_state.linha not in linhas:
        st.session_state.linha = "Todas as linhas"
    filtro, contagem = st.columns([1.5, 3], vertical_alignment="bottom")
    with filtro:
        st.selectbox(
            "Linha",
            linhas,
            key="linha",
            format_func=lambda item: "Todas as linhas" if item == "Todas as linhas" else linha_curta(item),
        )
    st.session_state.busca_salva = st.session_state.busca
    st.session_state.linha_salva = st.session_state.linha
    encontrados = filtrar_produtos(resumo, st.session_state.busca_salva, st.session_state.linha_salva)
    with contagem:
        st.caption(
            f"{len(encontrados)} de {len(resumo)} produtos · {st.session_state.arquivo_nome}"
        )

    if encontrados.empty:
        st.markdown(
            "<div class='vazio'>Nenhum produto com esse código ou nome.</div>",
            unsafe_allow_html=True,
        )
        return

    _salvar_cache()
    registros = list(encontrados.itertuples(index=False))
    for inicio in range(0, len(registros), 2):
        colunas = st.columns(2, gap="small")
        for coluna, linha in zip(colunas, registros[inicio:inicio + 2]):
            with coluna:
                _render_card(linha)


def _unitarios_iguais(linhas) -> bool:
    valores = {
        round(float(valor), 2)
        for valor in linhas["preco_uni"]
        if pd.notna(valor)
    }
    return len(valores) <= 1


def _tabela_precos(linhas, mostrar_unitario: bool) -> str:
    cabecalhos = ["Embalagem", "Qtd", "À vista", "7 dias", "14 dias", "21 dias", "28 dias"]
    if mostrar_unitario:
        cabecalhos.append("Unitário")
    head = "".join(
        f"<th class='num'>{html.escape(titulo)}</th>" if indice else f"<th>{html.escape(titulo)}</th>"
        for indice, titulo in enumerate(cabecalhos)
    )
    corpo = []
    for linha in linhas.itertuples(index=False):
        celulas = [
            "<td><span class='emb'>"
            f"{html.escape(rotulo_embalagem(linha.embalagem))}</span>"
            f"<span class='sigla'>{html.escape(str(linha.embalagem))}</span></td>",
            f"<td class='num'>{int(linha.qtd)}</td>",
        ]
        celulas.extend(
            f"<td class='num'>{moeda(getattr(linha, campo))}</td>"
            for campo, _rotulo in PRAZOS
        )
        if mostrar_unitario:
            celulas.append(f"<td class='num'>{moeda(linha.preco_uni)}</td>")
        corpo.append("<tr>" + "".join(celulas) + "</tr>")
    return (
        "<div class='tabela-wrap'><table class='precos'>"
        f"<thead><tr>{head}</tr></thead>"
        f"<tbody>{''.join(corpo)}</tbody></table></div>"
    )


def tela_detalhe() -> None:
    catalogo = st.session_state.catalogo
    codigo = str(st.session_state.cod_sel)
    linhas = ordenar_embalagens(catalogo[catalogo["cod"].astype(str).eq(codigo)])

    if st.button("Voltar"):
        st.session_state.tela = "catalogo"
        st.rerun()

    if linhas.empty:
        st.warning("Esse produto não está no catálogo carregado.")
        return

    produto = linhas.iloc[0]
    st.markdown(
        f"<p class='prod-kicker'>{html.escape(linha_curta(produto.categoria1))}</p>",
        unsafe_allow_html=True,
    )
    st.markdown(
        f"<h1 class='prod-title'>{html.escape(str(produto.produto))}</h1>",
        unsafe_allow_html=True,
    )
    st.markdown(
        "<p class='prod-meta'>"
        f"Código {html.escape(codigo)} · EAN {html.escape(str(produto.ean) or '—')}"
        "</p>",
        unsafe_allow_html=True,
    )
    if _unitarios_iguais(linhas):
        st.markdown(
            f"<p class='unitario-nota'>Preço por unidade em 28 dias: {moeda(produto.preco_uni)}</p>",
            unsafe_allow_html=True,
        )
        st.markdown(_tabela_precos(linhas, mostrar_unitario=False), unsafe_allow_html=True)
    else:
        st.markdown(_tabela_precos(linhas, mostrar_unitario=True), unsafe_allow_html=True)


def main() -> None:
    garantir_estado()
    aplicar_estilo()
    redirecionar_sku()

    catalogo = st.session_state.catalogo
    tela = st.session_state.tela
    if tela == "detalhe" and isinstance(catalogo, pd.DataFrame):
        tela_detalhe()
    elif tela == "catalogo" and isinstance(catalogo, pd.DataFrame):
        tela_catalogo()
    else:
        tela_boas_vindas()


st.set_page_config(
    page_title="Consultor SC Johnson",
    layout="wide",
    initial_sidebar_state="collapsed",
)
main()
