import { useEffect, useMemo, useState } from "react"
import {
  carregarPlanilha,
  embalagensDo,
  filtrar,
  linhaCurta,
  moeda,
  resumir,
  rotuloEmbalagem,
  unitariosIguais,
} from "./catalogo.js"

const PRAZOS = [
  ["avista", "À vista"],
  ["d7", "7 dias"],
  ["d14", "14 dias"],
  ["d21", "21 dias"],
  ["d28", "28 dias"],
]

export default function App() {
  const [tela, setTela] = useState("boas")
  const [linhas, setLinhas] = useState([])
  const [busca, setBusca] = useState("")
  const [linhaFiltro, setLinhaFiltro] = useState("Todas as linhas")
  const [codSel, setCodSel] = useState(null)
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)
  const [antesDaCalculadora, setAntesDaCalculadora] = useState("catalogo")

  const produtos = useMemo(() => resumir(linhas), [linhas])
  const linhasDisponiveis = useMemo(() => {
    const nomes = [...new Set(produtos.map((item) => item.categoria1).filter(Boolean))]
    nomes.sort((a, b) => a.localeCompare(b, "pt-BR"))
    return ["Todas as linhas", ...nomes]
  }, [produtos])
  const encontrados = useMemo(
    () => filtrar(produtos, busca, linhaFiltro),
    [produtos, busca, linhaFiltro],
  )
  const detalhe = useMemo(
    () => (codSel === null ? [] : embalagensDo(linhas, codSel)),
    [linhas, codSel],
  )

  async function acessar() {
    setErro("")
    if (linhas.length) {
      setTela("catalogo")
      return
    }
    setCarregando(true)
    try {
      setLinhas(await carregarPlanilha())
      setTela("catalogo")
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível ler a planilha.")
    } finally {
      setCarregando(false)
    }
  }

  function abrirProduto(cod) {
    setCodSel(cod)
    setTela("detalhe")
  }

  function abrirCalculadora() {
    setAntesDaCalculadora(tela)
    setTela("calculadora")
  }

  if (tela === "calculadora") {
    return (
      <Calculadora
        linhas={linhas}
        codInicial={antesDaCalculadora === "detalhe" ? codSel : null}
        onVoltar={() => setTela(antesDaCalculadora)}
      />
    )
  }
  if (tela === "detalhe") {
    return (
      <Detalhe
        linhas={detalhe}
        onVoltar={() => setTela("catalogo")}
        onCalculadora={abrirCalculadora}
      />
    )
  }
  if (tela === "catalogo") {
    return (
      <Catalogo
        busca={busca}
        onBusca={setBusca}
        linhaFiltro={linhaFiltro}
        onLinha={setLinhaFiltro}
        linhasDisponiveis={linhasDisponiveis}
        encontrados={encontrados}
        total={produtos.length}
        onAbrir={abrirProduto}
        onCalculadora={abrirCalculadora}
      />
    )
  }
  return <BoasVindas onAcessar={acessar} carregando={carregando} erro={erro} />
}

function BoasVindas({ onAcessar, carregando, erro }) {
  return (
    <main className="boas">
      <section className="boas-miolo">
        <img className="logo" src="/scj_logo.svg" alt="SC Johnson" />
        <p className="hero-kicker">Condições comerciais</p>
        <h1 className="hero-title">Consultor comercial</h1>
        <p className="hero-text">
          Consulte produto, embalagem e preço por prazo. A busca fica disponível na tela seguinte.
        </p>
        <button className="botao-acesso" type="button" onClick={onAcessar} disabled={carregando}>
          {carregando ? "Abrindo catálogo..." : "Acessar"}
        </button>
        {erro ? <p className="erro">{erro}</p> : null}
      </section>
    </main>
  )
}

function Catalogo({
  busca,
  onBusca,
  linhaFiltro,
  onLinha,
  linhasDisponiveis,
  encontrados,
  total,
  onAbrir,
  onCalculadora,
}) {
  return (
    <main className="pagina">
      <div className="topo">
        <img className="logo logo-catalogo" src="/scj_logo.svg" alt="SC Johnson" />
        <button className="icone-calc" type="button" aria-label="Abrir calculadora" onClick={onCalculadora}>
          <IconeCalculadora />
        </button>
      </div>
      <input
        className="campo busca"
        value={busca}
        onChange={(evento) => onBusca(evento.target.value)}
        placeholder="Buscar por código ou nome"
        aria-label="Buscar produto"
      />
      <div className="filtros">
        <label>
          Linha
          <select className="selecao" value={linhaFiltro} onChange={(evento) => onLinha(evento.target.value)}>
            {linhasDisponiveis.map((nome) => (
              <option key={nome} value={nome}>
                {nome === "Todas as linhas" ? nome : linhaCurta(nome)}
              </option>
            ))}
          </select>
        </label>
        <p className="contagem">
          {encontrados.length} de {total} produtos · disponível offline
        </p>
      </div>
      {encontrados.length === 0 ? (
        <p className="vazio">Nenhum produto com esse código ou nome.</p>
      ) : (
        <div className="sku-grid">
          {encontrados.map((item) => {
            const embalagens = item.nEmb === 1 ? "1 embalagem" : `${item.nEmb} embalagens`
            return (
              <button key={item.cod} type="button" className="sku-card" onClick={() => onAbrir(item.cod)}>
                <span className="sku-top">
                  <span className="sku-cod">{item.cod}</span>
                  <span className="sku-cat">{linhaCurta(item.categoria1)}</span>
                </span>
                <span className="sku-nome">{item.produto}</span>
                <span className="sku-sub">
                  {embalagens} · unid. a partir de {moeda(item.precoUniMin)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </main>
  )
}

function Detalhe({ linhas, onVoltar, onCalculadora }) {
  if (!linhas.length) {
    return (
      <main className="pagina">
        <BarraVoltar onVoltar={onVoltar} onCalculadora={onCalculadora} />
        <p className="erro">Esse produto não está no catálogo carregado.</p>
      </main>
    )
  }
  const produto = linhas[0]
  const igual = unitariosIguais(linhas)
  return (
    <main className="pagina">
      <BarraVoltar onVoltar={onVoltar} onCalculadora={onCalculadora} />
      <p className="prod-kicker">{linhaCurta(produto.categoria1)}</p>
      <h1 className="prod-title">{produto.produto}</h1>
      <p className="prod-meta">
        Código {produto.cod} · EAN {produto.ean || "—"}
      </p>
      {igual ? <p className="unitario-nota">Preço por unidade em 28 dias: {moeda(produto.preco_uni)}</p> : null}
      <div className="tabela-wrap">
        <table className="precos">
          <thead>
            <tr>
              <th>Embalagem</th>
              <th className="num">Qtd</th>
              {PRAZOS.map(([, rotulo]) => (
                <th key={rotulo} className="num">
                  {rotulo}
                </th>
              ))}
              {igual ? null : <th className="num">Unitário</th>}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={`${linha.embalagem}-${linha.qtd}`}>
                <td>
                  <span className="emb">{rotuloEmbalagem(linha.embalagem)}</span>
                  <span className="sigla">{linha.embalagem}</span>
                </td>
                <td className="num">{linha.qtd}</td>
                {PRAZOS.map(([campo]) => (
                  <td key={campo} className="num">
                    {moeda(linha[campo])}
                  </td>
                ))}
                {igual ? null : <td className="num">{moeda(linha.preco_uni)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

function BarraVoltar({ onVoltar, onCalculadora }) {
  return (
    <div className="barra-voltar">
      <button className="voltar" type="button" onClick={onVoltar}>
        Voltar
      </button>
      <button className="icone-calc" type="button" aria-label="Abrir calculadora" onClick={onCalculadora}>
        <IconeCalculadora />
      </button>
    </div>
  )
}

function chaveEmbalagem(linha) {
  return `${linha.embalagem}|${linha.qtd}`
}

function quantidadeInformada(texto) {
  if (!/^\d+$/.test(String(texto))) return null
  const numero = Number(texto)
  if (numero < 1) return null
  return numero
}

function centavos(valor) {
  return Math.round(valor * 100) / 100
}

function valorDigitado(texto) {
  const limpo = String(texto).trim()
  if (!limpo) return null
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo
  if (!/^\d+(\.\d+)?$/.test(normal)) return null
  const numero = Number(normal)
  return Number.isFinite(numero) ? numero : null
}

function percentualTexto(valor) {
  return `${Math.abs(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

const ATALHOS = [3, 5, 7, 10]

function textoDigitavel(valor) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function textoDesconto(diferenca, unitario) {
  if (diferenca === null || !unitario) return "—"
  const percentual = (diferenca / unitario) * 100
  if (diferenca === 0) return "R$ 0,00"
  const sinal = diferenca > 0 ? "" : "− "
  return `${sinal}${moeda(Math.abs(diferenca))} · ${percentualTexto(percentual)}`
}

function Calculadora({ linhas, codInicial, onVoltar }) {
  const produtos = useMemo(() => resumir(linhas), [linhas])
  const produtoInicial = produtos.find((item) => String(item.cod) === String(codInicial)) ?? null
  const [busca, setBusca] = useState("")
  const [produto, setProduto] = useState(produtoInicial)
  const [chavePack, setChavePack] = useState("")
  const [quantidade, setQuantidade] = useState("1")
  const [prazo, setPrazo] = useState("avista")
  const [sugerido, setSugerido] = useState("")
  const [atalho, setAtalho] = useState(null)

  const sugestoes = useMemo(() => {
    if (produto || !busca.trim()) return []
    return filtrar(produtos, busca, "Todas as linhas").slice(0, 8)
  }, [produto, busca, produtos])
  const packs = useMemo(
    () => (produto ? embalagensDo(linhas, produto.cod) : []),
    [produto, linhas],
  )
  const pack = packs.find((item) => chaveEmbalagem(item) === chavePack) || packs[0] || null
  const qtd = quantidadeInformada(quantidade)
  const preco = pack ? pack[prazo] : null
  const total = preco !== null && qtd !== null ? centavos(preco * qtd) : null
  const unitario = preco !== null && pack?.qtd ? centavos(preco / pack.qtd) : null
  const sugeridoNum = valorDigitado(sugerido)
  const unidades = pack && qtd !== null ? pack.qtd * qtd : null
  const diferenca = unitario !== null && sugeridoNum !== null ? centavos(unitario - sugeridoNum) : null
  const soma = sugeridoNum !== null && unidades !== null ? centavos(sugeridoNum * unidades) : null
  const condicao = PRAZOS.find(([campo]) => campo === prazo)?.[1] ?? ""

  useEffect(() => {
    if (atalho === null || unitario === null) return
    setSugerido(textoDigitavel(centavos(unitario * (1 - atalho / 100))))
  }, [atalho, unitario])

  function escolher(item) {
    setProduto(item)
    setBusca("")
    setChavePack("")
    setQuantidade("1")
    setSugerido("")
    setAtalho(null)
  }

  return (
    <main className="pagina">
      <button className="voltar" type="button" onClick={onVoltar}>
        Voltar
      </button>
      <h1 className="prod-title">Simulação</h1>
      <div className="calc-layout">
        <section className="calc-form">
          <div className="calc-campo">
            <span>Produto</span>
            {produto ? (
              <div className="calc-escolhido">
                <span>
                  <span className="sku-cod">{produto.cod}</span>
                  <strong>{produto.produto}</strong>
                  <span className="sku-cat">{linhaCurta(produto.categoria1)}</span>
                </span>
                <button className="voltar" type="button" onClick={() => escolher(null)}>
                  Trocar
                </button>
              </div>
            ) : (
              <input
                className="campo"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar por código ou nome"
                aria-label="Buscar produto para simular"
              />
            )}
          </div>
          {!produto && busca.trim() ? (
            sugestoes.length ? (
              <ul className="calc-sugestoes">
                {sugestoes.map((item) => (
                  <li key={item.cod}>
                    <button type="button" onClick={() => escolher(item)}>
                      <span className="sku-cod">{item.cod}</span>
                      <span>{item.produto}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="vazio">Nenhum produto com esse código ou nome.</p>
            )
          ) : null}
          <label className="calc-campo">
            Embalagem
            <select
              className="selecao"
              value={pack ? chaveEmbalagem(pack) : ""}
              onChange={(evento) => setChavePack(evento.target.value)}
              disabled={!produto}
            >
              {packs.map((item) => (
                <option key={chaveEmbalagem(item)} value={chaveEmbalagem(item)}>
                  {rotuloEmbalagem(item.embalagem)} ({item.embalagem}) · {item.qtd} un
                </option>
              ))}
            </select>
          </label>
          <div className="calc-dupla">
            <label className="calc-campo">
              Quantidade
              <input
                className="campo"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={quantidade}
                onChange={(evento) => setQuantidade(evento.target.value)}
                disabled={!produto}
                aria-label="Quantidade de embalagens"
              />
            </label>
            <label className="calc-campo">
              Condição de pagamento
              <select
                className="selecao"
                value={prazo}
                onChange={(evento) => setPrazo(evento.target.value)}
                disabled={!produto}
              >
                {PRAZOS.map(([campo, rotulo]) => (
                  <option key={campo} value={campo}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="calc-lado">
            <label className="calc-campo">
              Valor unitário sugerido
              <input
                className="campo"
                inputMode="decimal"
                value={sugerido}
                onChange={(evento) => {
                  setAtalho(null)
                  setSugerido(evento.target.value)
                }}
                placeholder="0,00"
                disabled={!produto}
                aria-label="Valor unitário sugerido"
              />
            </label>
            <div className="calc-campo">
              <span>Desconto na unidade</span>
              <p className="calc-leitura">{textoDesconto(diferenca, unitario)}</p>
            </div>
          </div>
          <div className="calc-campo">
            <span>Atalhos de desconto</span>
            <div className="calc-atalhos">
              {ATALHOS.map((percentual) => (
                <button
                  key={percentual}
                  type="button"
                  className={atalho === percentual ? "atalho ativo" : "atalho"}
                  disabled={unitario === null}
                  onClick={() => setAtalho(percentual)}
                >
                  −{percentual}%
                </button>
              ))}
            </div>
          </div>
          <div className="calc-campo">
            <span>Total sugerido</span>
            <p className="calc-leitura">
              {soma === null || sugeridoNum === null || unidades === null
                ? "—"
                : `${moeda(soma)} · ${moeda(sugeridoNum)} × ${unidades} ${unidades === 1 ? "unidade" : "unidades"}`}
            </p>
          </div>
        </section>
        <aside className="calc-total">
          <p className="prod-kicker">Total</p>
          <p className="calc-valor">{total === null ? "—" : moeda(total)}</p>
          {pack && qtd !== null && preco !== null ? (
            <p className="calc-resumo">
              {`${qtd} ${rotuloEmbalagem(pack.embalagem).toLowerCase()}${qtd > 1 ? "s" : ""} · ${
                pack.qtd * qtd === 1 ? "1 unidade" : `${pack.qtd * qtd} unidades`
              }`}
              <br />
              {moeda(preco)} por {rotuloEmbalagem(pack.embalagem).toLowerCase()} · {condicao}
              <br />
              {moeda(unitario)} por unidade
            </p>
          ) : (
            <p className="calc-resumo">
              {produto ? "Informe uma quantidade inteira a partir de 1." : "Selecione um produto para simular."}
            </p>
          )}
        </aside>
      </div>
    </main>
  )
}

function IconeCalculadora({ grande = false }) {
  const tamanho = grande ? 42 : 22
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="7" y="5" width="10" height="3.2" rx="0.6" fill="currentColor" />
      <circle cx="8.2" cy="12.2" r="0.9" fill="currentColor" />
      <circle cx="12" cy="12.2" r="0.9" fill="currentColor" />
      <circle cx="15.8" cy="12.2" r="0.9" fill="currentColor" />
      <circle cx="8.2" cy="16" r="0.9" fill="currentColor" />
      <circle cx="12" cy="16" r="0.9" fill="currentColor" />
      <circle cx="15.8" cy="16" r="0.9" fill="currentColor" />
      <circle cx="8.2" cy="19.4" r="0.9" fill="currentColor" />
      <rect x="11.1" y="18.6" width="5.6" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  )
}
