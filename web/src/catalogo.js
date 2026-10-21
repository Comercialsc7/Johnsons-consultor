import * as XLSX from "xlsx"

const ROTULOS = {
  UN: "Unidade",
  CJ: "Conjunto",
  CX: "Caixa",
  DS: "Display",
  PT: "Pacote",
}

const ORDEM = { UN: 0, CJ: 1, CX: 2, DS: 3, PT: 4 }

const NOMES = {
  CATEGORIA1: "categoria1",
  CATEGORIA2: "categoria2",
  CODAUXAFV: "codaux",
  FORNECEDOR: "fornecedor",
  "COD PRODUTO": "cod",
  CODPRODUTO: "cod",
  PRODUTO: "produto",
  EAN: "ean",
  EMBALAGEM: "embalagem",
  "QTD EMBALAGEM": "qtd",
  "QTDE EMBALAGEM": "qtd",
  "A VISTA": "avista",
  AVISTA: "avista",
  7: "d7",
  "7 DIAS": "d7",
  14: "d14",
  "14 DIAS": "d14",
  21: "d21",
  "21 DIAS": "d21",
  28: "d28",
  "28 DIAS": "d28",
}

const OBRIGATORIAS = {
  cod: "COD PRODUTO",
  produto: "PRODUTO",
  embalagem: "EMBALAGEM",
  qtd: "QTD EMBALAGEM",
  avista: "AVISTA",
  d7: "7",
  d14: "14",
  d21: "21",
  d28: "28",
}

function semAcento(texto) {
  return String(texto).normalize("NFD").replace(/\p{M}/gu, "")
}

function chaveColuna(nome) {
  return semAcento(nome).toUpperCase().split(/\s+/).filter(Boolean).join(" ")
}

export function linhaCurta(categoria) {
  let texto = String(categoria).split(/\s+/).filter(Boolean).join(" ")
  if (texto.toUpperCase().startsWith("JOHNSON ")) texto = texto.slice(8).trim()
  if (texto.toUpperCase() === "OFF") return "OFF"
  const miudas = new Set(["de", "da", "do", "e"])
  return texto
    .split(" ")
    .map((palavra, indice) => {
      const baixa = palavra.toLowerCase()
      if (indice > 0 && miudas.has(baixa)) return baixa
      return baixa.charAt(0).toUpperCase() + baixa.slice(1)
    })
    .join(" ")
}

export function rotuloEmbalagem(sigla) {
  const codigo = String(sigla || "").trim().toUpperCase()
  return ROTULOS[codigo] || codigo
}

export function moeda(valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "—"
  return `R$ ${Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function numero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null
  if (valor === null || valor === undefined || String(valor).trim() === "") return null
  const texto = String(valor).trim()
  const normal = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto
  const convertido = Number(normal)
  return Number.isFinite(convertido) ? convertido : null
}

function eanTexto(valor) {
  if (valor === null || valor === undefined || valor === "") return ""
  if (typeof valor === "number" && Number.isFinite(valor)) return String(Math.trunc(valor))
  const texto = String(valor).trim()
  return texto.endsWith(".0") ? texto.slice(0, -2) : texto
}

export function lerPlanilha(bruto) {
  if (!bruto.length) throw new Error("A planilha não tem linhas.")
  const mapa = {}
  for (const coluna of Object.keys(bruto[0])) {
    const chave = chaveColuna(coluna)
    if (NOMES[chave]) mapa[coluna] = NOMES[chave]
    else if (chave.includes("PRECO") && chave.includes("UNI")) mapa[coluna] = "preco_uni"
  }
  const presentes = new Set(Object.values(mapa))
  const faltando = Object.entries(OBRIGATORIAS)
    .filter(([campo]) => !presentes.has(campo))
    .map(([, rotulo]) => rotulo)
  if (faltando.length) {
    throw new Error(`Colunas ausentes na planilha: ${faltando.join(", ")}.`)
  }

  const vistos = new Set()
  const linhas = []
  for (const origem of bruto) {
    const item = {
      categoria1: "",
      categoria2: "",
      fornecedor: "",
      ean: "",
    }
    for (const [coluna, destino] of Object.entries(mapa)) item[destino] = origem[coluna]
    item.produto = String(item.produto ?? "").trim()
    item.embalagem = String(item.embalagem ?? "").trim().toUpperCase()
    item.categoria1 = String(item.categoria1 ?? "").trim()
    item.categoria2 = String(item.categoria2 ?? "").trim()
    item.fornecedor = String(item.fornecedor ?? "").trim()
    item.cod = numero(item.cod)
    item.qtd = numero(item.qtd)
    item.ean = eanTexto(item.ean)
    for (const campo of ["avista", "d7", "d14", "d21", "d28", "preco_uni"]) {
      item[campo] = numero(item[campo])
    }
    if (item.cod === null || !item.produto || !item.embalagem || !item.qtd) continue
    item.cod = Math.trunc(item.cod)
    item.qtd = Math.trunc(item.qtd)
    if (item.preco_uni === null && item.d28 !== null) item.preco_uni = item.d28 / item.qtd
    const chave = `${item.cod}|${item.embalagem}|${item.qtd}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    linhas.push(item)
  }
  if (!linhas.length) throw new Error("Nenhum produto válido foi encontrado na planilha.")
  return linhas
}

const PLANILHA_SALVA = "consultor.planilha"

function linhasDoBuffer(buffer) {
  const livro = XLSX.read(buffer, { type: "array" })
  const aba = livro.Sheets[livro.SheetNames[0]]
  return lerPlanilha(XLSX.utils.sheet_to_json(aba, { defval: "", raw: true }))
}

function guardarPlanilha(linhas) {
  try {
    localStorage.setItem(PLANILHA_SALVA, JSON.stringify(linhas))
  } catch {
    // Sem espaço no aparelho, a cópia do service worker continua disponível.
  }
}

function recuperarPlanilha() {
  try {
    const salvo = JSON.parse(localStorage.getItem(PLANILHA_SALVA) || "null")
    if (!Array.isArray(salvo) || !salvo.length) return null
    return salvo
  } catch {
    return null
  }
}

export async function carregarPlanilha() {
  try {
    const resposta = await fetch("/baseapp.xlsx", { signal: AbortSignal.timeout(8000) })
    if (!resposta.ok) throw new Error("A planilha baseapp.xlsx não está disponível.")
    const linhas = linhasDoBuffer(await resposta.arrayBuffer())
    guardarPlanilha(linhas)
    return linhas
  } catch (erro) {
    const salva = recuperarPlanilha()
    if (salva) return salva
    if (erro instanceof Error && erro.message.startsWith("A planilha")) throw erro
    throw new Error("Sem conexão e nenhuma planilha salva neste aparelho. Abra o app online uma vez.")
  }
}

export function resumir(linhas) {
  const mapa = new Map()
  for (const linha of linhas) {
    const atual = mapa.get(linha.cod)
    if (!atual) {
      mapa.set(linha.cod, {
        cod: linha.cod,
        produto: linha.produto,
        categoria1: linha.categoria1,
        categoria2: linha.categoria2,
        ean: linha.ean,
        nEmb: 1,
        precoUniMin: linha.preco_uni,
        embalagens: new Set([linha.embalagem]),
      })
      continue
    }
    atual.embalagens.add(linha.embalagem)
    atual.nEmb = atual.embalagens.size
    if (linha.preco_uni !== null && linha.preco_uni < atual.precoUniMin) {
      atual.precoUniMin = linha.preco_uni
    }
  }
  return [...mapa.values()]
    .map(({ embalagens, ...item }) => item)
    .sort((a, b) => a.produto.localeCompare(b.produto, "pt-BR"))
}

export function filtrar(produtos, termo, linha) {
  const texto = semAcento(termo.trim().replace(/\s+/g, " ")).toLowerCase()
  return produtos.filter((item) => {
    if (linha && linha !== "Todas as linhas" && item.categoria1 !== linha) return false
    if (!texto) return true
    const nome = semAcento(item.produto).toLowerCase()
    return nome.includes(texto) || String(item.cod).includes(texto) || String(item.ean).includes(texto)
  })
}

export function embalagensDo(linhas, cod) {
  return linhas
    .filter((linha) => String(linha.cod) === String(cod))
    .sort((a, b) => (ORDEM[a.embalagem] ?? 9) - (ORDEM[b.embalagem] ?? 9) || a.qtd - b.qtd)
}

export function unitariosIguais(linhas) {
  const valores = new Set(linhas.map((linha) => Math.round(Number(linha.preco_uni) * 100)))
  return valores.size <= 1
}
