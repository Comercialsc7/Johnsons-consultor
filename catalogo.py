"""Leitura e consulta da planilha de condições comerciais."""

from __future__ import annotations

import math
import unicodedata
from typing import BinaryIO

import pandas as pd

ROTULOS_EMBALAGEM = {
    "UN": "Unidade",
    "CJ": "Conjunto",
    "CX": "Caixa",
    "DS": "Display",
    "PT": "Pacote",
}

ORDEM_EMBALAGEM = {"UN": 0, "CJ": 1, "CX": 2, "DS": 3, "PT": 4}

_NOMES_COLUNA = {
    "CATEGORIA1": "categoria1",
    "CATEGORIA2": "categoria2",
    "CODAUXAFV": "codaux",
    "FORNECEDOR": "fornecedor",
    "COD PRODUTO": "cod",
    "CODPRODUTO": "cod",
    "PRODUTO": "produto",
    "EAN": "ean",
    "EMBALAGEM": "embalagem",
    "QTD EMBALAGEM": "qtd",
    "QTDE EMBALAGEM": "qtd",
    "A VISTA": "avista",
    "AVISTA": "avista",
    "7": "d7",
    "7 DIAS": "d7",
    "14": "d14",
    "14 DIAS": "d14",
    "21": "d21",
    "21 DIAS": "d21",
    "28": "d28",
    "28 DIAS": "d28",
}

_OBRIGATORIAS = {
    "cod": "COD PRODUTO",
    "produto": "PRODUTO",
    "embalagem": "EMBALAGEM",
    "qtd": "QTD EMBALAGEM",
    "avista": "AVISTA",
    "d7": "7",
    "d14": "14",
    "d21": "21",
    "d28": "28",
}

_PRECOS = ("avista", "d7", "d14", "d21", "d28", "preco_uni")


def _sem_acento(texto: str) -> str:
    base = unicodedata.normalize("NFKD", str(texto))
    return "".join(ch for ch in base if not unicodedata.combining(ch))


def _chave_coluna(nome) -> str:
    return " ".join(_sem_acento(nome).upper().split())


def linha_curta(categoria: str) -> str:
    texto = " ".join(str(categoria).split())
    if texto.upper().startswith("JOHNSON "):
        texto = texto[8:].strip()
    if texto.upper() == "OFF":
        return "OFF"
    miudas = {"de", "da", "do", "e"}
    partes = []
    for indice, palavra in enumerate(texto.split()):
        baixa = palavra.lower()
        if indice > 0 and baixa in miudas:
            partes.append(baixa)
        else:
            partes.append(baixa.capitalize())
    return " ".join(partes)


def rotulo_embalagem(sigla: str) -> str:
    codigo = str(sigla).strip().upper()
    return ROTULOS_EMBALAGEM.get(codigo, codigo)


def qtd_por_extenso(qtd) -> str:
    numero = int(qtd)
    unidade = "unidade" if numero == 1 else "unidades"
    return f"{numero} {unidade}"


def moeda(valor) -> str:
    if valor is None or (isinstance(valor, float) and math.isnan(valor)):
        return "—"
    try:
        if pd.isna(valor):
            return "—"
    except TypeError:
        pass
    texto = f"{float(valor):,.2f}"
    return "R$ " + texto.replace(",", "X").replace(".", ",").replace("X", ".")


def percentual(valor) -> str:
    texto = f"{float(valor):,.2f}%"
    return texto.replace(",", "X").replace(".", ",").replace("X", ".")


def ler_catalogo(origem: str | BinaryIO) -> pd.DataFrame:
    bruto = pd.read_excel(origem, engine="openpyxl")
    if bruto.empty:
        raise ValueError("A planilha não tem linhas.")

    renomear = {}
    for coluna in bruto.columns:
        chave = _chave_coluna(coluna)
        if chave in _NOMES_COLUNA:
            renomear[coluna] = _NOMES_COLUNA[chave]
        elif "PRECO" in chave and "UNI" in chave:
            renomear[coluna] = "preco_uni"
    df = bruto.rename(columns=renomear)

    faltando = [rotulo for chave, rotulo in _OBRIGATORIAS.items() if chave not in df.columns]
    if faltando:
        raise ValueError("Colunas ausentes na planilha: " + ", ".join(faltando) + ".")

    for coluna in ("categoria1", "categoria2", "fornecedor", "produto", "embalagem"):
        if coluna not in df.columns:
            df[coluna] = ""
        df[coluna] = df[coluna].fillna("").astype(str).str.strip()
    df["embalagem"] = df["embalagem"].str.upper()

    df["cod"] = pd.to_numeric(df["cod"], errors="coerce")
    if "ean" not in df.columns:
        df["ean"] = ""
    df["ean"] = df["ean"].apply(_ean_texto)
    if "codaux" not in df.columns:
        df["codaux"] = ""

    for coluna in ("qtd",) + _PRECOS:
        if coluna not in df.columns:
            continue
        df[coluna] = pd.to_numeric(df[coluna], errors="coerce")

    df = df.dropna(subset=["cod", "produto", "embalagem", "qtd"])
    df = df[df["produto"].ne("") & df["embalagem"].ne("") & df["qtd"].gt(0)]
    if df.empty:
        raise ValueError("Nenhum produto válido foi encontrado na planilha.")

    df["cod"] = df["cod"].astype("int64")
    df["qtd"] = df["qtd"].astype("int64")
    if "preco_uni" not in df.columns:
        df["preco_uni"] = pd.NA
    sem_unitario = df["preco_uni"].isna()
    df.loc[sem_unitario, "preco_uni"] = df.loc[sem_unitario, "d28"] / df.loc[sem_unitario, "qtd"]

    df = df.drop_duplicates(["cod", "embalagem", "qtd"], keep="first")
    colunas = [
        "categoria1",
        "categoria2",
        "codaux",
        "fornecedor",
        "cod",
        "produto",
        "ean",
        "embalagem",
        "qtd",
        "avista",
        "d7",
        "d14",
        "d21",
        "d28",
        "preco_uni",
    ]
    return df[colunas].reset_index(drop=True)


def _ean_texto(valor) -> str:
    if valor is None or (isinstance(valor, float) and math.isnan(valor)):
        return ""
    try:
        if pd.isna(valor):
            return ""
    except TypeError:
        pass
    if isinstance(valor, float) and valor.is_integer():
        return str(int(valor))
    if isinstance(valor, int):
        return str(valor)
    texto = str(valor).strip()
    if texto.endswith(".0"):
        texto = texto[:-2]
    return texto


def resumir_produtos(df: pd.DataFrame) -> pd.DataFrame:
    resumo = (
        df.groupby("cod", as_index=False)
        .agg(
            produto=("produto", "first"),
            categoria1=("categoria1", "first"),
            categoria2=("categoria2", "first"),
            ean=("ean", "first"),
            fornecedor=("fornecedor", "first"),
            n_emb=("embalagem", "nunique"),
            preco_uni_min=("preco_uni", "min"),
        )
        .sort_values("produto", kind="mergesort")
        .reset_index(drop=True)
    )
    return resumo


def filtrar_produtos(resumo: pd.DataFrame, termo: str, linha: str) -> pd.DataFrame:
    saida = resumo
    if linha and linha != "Todas as linhas":
        saida = saida[saida["categoria1"].eq(linha)]
    texto = " ".join(str(termo).split()).lower()
    if not texto:
        return saida
    consulta = _sem_acento(texto)
    nome = saida["produto"].map(lambda item: _sem_acento(item).lower())
    codigo = saida["cod"].astype(str)
    ean = saida["ean"].astype(str)
    mask = nome.str.contains(consulta, regex=False) | codigo.str.contains(consulta, regex=False)
    mask = mask | ean.str.contains(consulta, regex=False)
    return saida[mask]


def ordenar_embalagens(df: pd.DataFrame) -> pd.DataFrame:
    ordenado = df.copy()
    ordenado["_ordem"] = ordenado["embalagem"].map(lambda sigla: ORDEM_EMBALAGEM.get(sigla, 9))
    ordenado = ordenado.sort_values(["_ordem", "qtd"], kind="mergesort")
    return ordenado.drop(columns="_ordem").reset_index(drop=True)


def acrescimo_28(avista, prazo_28) -> tuple[float, float] | None:
    if pd.isna(avista) or pd.isna(prazo_28) or float(avista) == 0:
        return None
    diferenca = float(prazo_28) - float(avista)
    taxa = diferenca / float(avista) * 100
    return diferenca, taxa
