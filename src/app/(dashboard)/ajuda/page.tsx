'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// ─── Dados ───────────────────────────────────────────────────────────────────

const guias = [
  {
    icone: '⚔️',
    titulo: 'Batalha',
    descricao: 'É aqui que você controla o combate em tempo real.',
    topicos: [
      { titulo: 'Como funciona', texto: 'A batalha é como um tabuleiro digital. Você adiciona os jogadores e os monstros, define a ordem de quem age (iniciativa) e vai controlando os pontos de vida de cada um durante o combate.' },
      { titulo: 'Carregar personagens', texto: 'Clique em "Carregar Personagens" para trazer automaticamente os personagens da sua campanha para a batalha. Você escolhe quais entram.' },
      { titulo: 'Dano e Cura', texto: 'Em cada linha, há um campo de número com dois botões: 💥 para aplicar dano e 💚 para curar. Digite o valor e clique no botão.' },
      { titulo: 'Vantagem e Desvantagem', texto: 'Os botões ▲ e ▼ ao lado da iniciativa ativam vantagem (rola 2 dados e usa o maior) ou desvantagem (usa o menor) para aquele combatente.' },
      { titulo: 'Condições', texto: 'Clique no ícone de condição para adicionar efeitos como Envenenado, Paralisado, etc. Passe o mouse sobre qualquer condição para ver o que ela faz.' },
      { titulo: 'Log de batalha', texto: 'Tudo que acontece durante o combate é registrado automaticamente. Ao encerrar a batalha, o log é salvo no seu Diário com um resumo.' },
      { titulo: 'XP e Dificuldade', texto: 'O painel de dificuldade mostra se o encontro é Fácil, Médio, Difícil ou Mortal para o seu grupo. Quando um monstro morre, o XP é somado automaticamente.' },
    ],
  },
  {
    icone: '👥',
    titulo: 'Personagens',
    descricao: 'Fichas completas dos seus jogadores, NPCs e monstros da campanha.',
    topicos: [
      { titulo: 'Tipos de personagem', texto: 'Você pode criar três tipos: 👤 Jogador (os heróis da mesa), 🧙 NPC (personagens da história) e 👹 Monstro (inimigos recorrentes com personalidade). Cada tipo tem uma cor diferente para facilitar a identificação.' },
      { titulo: 'Atributos e perícias', texto: 'Preencha os 6 atributos principais (Força, Destreza, etc.) e o app calcula automaticamente os modificadores e o bônus de proficiência. As perícias são calculadas automaticamente, mas você pode ajustar manualmente.' },
      { titulo: 'Espaços de magia', texto: 'Para personagens que conjuram magias, os espaços são calculados automaticamente pelo nível. Clique nas bolinhas para marcar os espaços usados. O botão "Descanso Longo" restaura tudo.' },
      { titulo: 'Inventário', texto: 'Itens adicionados pelas páginas de Itens e Armaduras aparecem aqui. Você pode ajustar a quantidade de cada item e clicar no nome para ver os detalhes.' },
      { titulo: 'Moedas', texto: 'Registre as moedas do personagem: PC (cobre), PP (prata), PE (electrum), PO (ouro) e Platina.' },
      { titulo: 'XP e Nível', texto: 'Ao atualizar os pontos de experiência, o nível e bônus de proficiência são atualizados automaticamente. Quando o personagem sobe de nível, aparece uma celebração especial! 🎉' },
      { titulo: 'Inspiração Heroica', texto: 'As 5 estrelas representam as inspirações do personagem. Distribua pelo botão na Batalha. Na ficha, clique numa estrela para usar uma inspiração.' },
    ],
  },
  {
    icone: '🐉',
    titulo: 'Bestiário',
    descricao: 'Biblioteca completa de monstros do SRD D&D 5e.',
    topicos: [
      { titulo: 'Busca e filtros', texto: 'Pesquise por nome (em português ou inglês) e filtre por CR (nível de desafio). Quanto maior o CR, mais perigoso o monstro.' },
      { titulo: 'Ficha do monstro', texto: 'Clique em qualquer monstro para ver todos os detalhes: atributos, habilidades especiais, ações, sentidos e idiomas.' },
      { titulo: 'Adicionar à batalha', texto: 'No card do monstro, clique em "Adicionar à Batalha" para incluí-lo no combate atual com todos os atributos já preenchidos.' },
      { titulo: 'Reportar erro', texto: 'Se encontrar algum dado incorreto, use o botão "⚑ Reportar" para nos avisar. Você pode sugerir a correção correta.' },
    ],
  },
  {
    icone: '✨',
    titulo: 'Magias',
    descricao: 'Biblioteca completa de magias do SRD D&D 5e.',
    topicos: [
      { titulo: 'Filtros disponíveis', texto: 'Filtre por nível (truques a 9º nível), escola de magia (Evocação, Necromancia, etc.) e classe (Mago, Clérigo, Druida, etc.).' },
      { titulo: 'Adicionar ao personagem', texto: 'Encontrou a magia certa? Clique em "+ Personagem" para adicioná-la diretamente à lista de magias de um personagem da campanha.' },
      { titulo: 'Concentração e Ritual', texto: 'Magias com o badge "Concentração" exigem atenção contínua — apenas uma pode estar ativa por vez. Magias "Ritual" podem ser conjuradas sem gastar espaço.' },
    ],
  },
  {
    icone: '🎒',
    titulo: 'Itens',
    descricao: 'Equipamentos, armas, armaduras e itens mágicos do SRD.',
    topicos: [
      { titulo: 'Abas disponíveis', texto: '✨ Itens Mágicos (poções, varinhas, anéis...), ⚔️ Armas (espadas, arcos...), 🛡️ Armaduras e 🎒 Equipamentos gerais.' },
      { titulo: 'Adicionar ao personagem', texto: 'Clique em "+ Personagem" em qualquer item. Armas são adicionadas como ataque na ficha (com dados de dano já preenchidos). Outros itens vão para o inventário.' },
      { titulo: 'Raridade dos itens mágicos', texto: 'A cor do badge indica a raridade: cinza=Comum, verde=Incomum, azul=Raro, roxo=Muito Raro, laranja=Lendário.' },
    ],
  },
  {
    icone: '📖',
    titulo: 'Aventura',
    descricao: 'Suba e organize o conteúdo da sua aventura.',
    topicos: [
      { titulo: 'Formatos aceitos', texto: 'O Dungeon Desk aceita arquivos PDF e Markdown (.md). O PDF é convertido automaticamente. O .md é recomendado para melhores resultados — veja a aba "Guia de Aventuras" para aprender a converter.' },
      { titulo: 'O que a IA faz', texto: 'A IA lê o texto da aventura e organiza tudo: locais, NPCs, monstros, encontros, tesouros e textos para leitura em voz alta — tudo dividido por capítulos.' },
      { titulo: 'Imagens e mapas', texto: 'A IA não lê imagens do PDF. Envie mapas e ilustrações separadamente pelas abas Mapas e Imagens da campanha.' },
      { titulo: 'Tempo de processamento', texto: 'Aventuras curtas levam 30-60 segundos. Aventuras longas (como campanhas completas) podem levar 2-3 minutos.' },
    ],
  },
  {
    icone: '📝',
    titulo: 'Diário',
    descricao: 'Suas anotações, logs de batalha e registro da campanha.',
    topicos: [
      { titulo: 'Tipos de entrada', texto: 'Crie notas, registros de NPCs, itens encontrados, pontos de enredo ou deixe o log de batalha ser salvo automaticamente.' },
      { titulo: 'Menções com @', texto: 'Digite @ seguido do nome para mencionar um personagem. Uma lista aparece para você selecionar. O nome vira um link — passe o mouse para ver um resumo, clique para ir à ficha.' },
      { titulo: 'Log automático de batalha', texto: 'Ao iniciar uma batalha com nome, tudo é registrado automaticamente. Ao encerrar, um resumo narrativo é salvo no diário.' },
    ],
  },
  {
    icone: '🖼️',
    titulo: 'Imagens e Mapas',
    descricao: 'Galeria visual da sua campanha.',
    topicos: [
      { titulo: 'Como adicionar', texto: 'Cole a URL de uma imagem (de qualquer site) e dê um nome. A imagem aparece na galeria organizada pela campanha.' },
      { titulo: 'Compartilhar com jogadores', texto: 'Ative o toggle "Compartilhar" para que seus jogadores possam ver a imagem ou mapa.' },
      { titulo: 'Mapas vs Imagens', texto: 'Use Mapas para plantas de dungeons, cidades e regiões. Use Imagens para retratos de NPCs, monstros, itens e handouts.' },
    ],
  },
  {
    icone: '🤖',
    titulo: 'Assistente IA',
    descricao: 'Seu parceiro de mesa inteligente.',
    topicos: [
      { titulo: 'O que ele sabe', texto: 'O assistente conhece sua campanha ativa: personagens, aventura carregada e contexto geral. Use para criar NPCs, gerar encontros, descrever ambientes ou tirar dúvidas de regras.' },
      { titulo: 'Limite de mensagens', texto: 'Cada plano tem um número de mensagens mensais. O contador aparece no topo da aba. Ao atingir o limite, faça upgrade para continuar.' },
      { titulo: 'Dicas de uso', texto: 'Seja específico: "Crie um NPC taverneiro humano, carismático, que esconde um segredo sobre o desaparecimento do prefeito" gera resultados muito melhores que "crie um NPC".' },
    ],
  },
]

const tiposPDF = [
  { tipo: 'PDF digital (Word, InDesign)', qualidade: '⭐⭐⭐⭐⭐ Excelente', dica: 'Converta diretamente, funciona perfeitamente.' },
  { tipo: 'PDF de aventuras WotC', qualidade: '⭐⭐⭐⭐ Boa', dica: 'Funciona bem, mas revise os títulos de capítulo após upload.' },
  { tipo: 'PDF em duas colunas', qualidade: '⭐⭐⭐ Média', dica: 'Converta para .md antes para melhor resultado.' },
  { tipo: 'PDF escaneado (foto de livro)', qualidade: '⭐ Ruim', dica: 'Use OCR antes: Adobe Acrobat, Google Drive ou Adobe Scan.' },
  { tipo: 'PDF com senha', qualidade: '❌ Não converte', dica: 'Remova a proteção antes de subir.' },
]

const dicasAventura = [
  { numero: 1, titulo: 'Revise os títulos', texto: 'A IA usa os títulos (#, ##, ###) para entender a estrutura. Se a conversão bagunçar os títulos, corrija — isso impacta tudo.' },
  { numero: 2, titulo: 'Separe textos de leitura em voz alta', texto: 'Coloque entre aspas ou em itálico os textos para ler aos jogadores. Ex: > "Vocês chegam a uma taverna escura..."' },
  { numero: 3, titulo: 'Remova cabeçalhos e rodapés', texto: 'Número de página e nome do livro repetido em todo rodapé viram lixo no meio do texto. Apague antes de subir.' },
  { numero: 4, titulo: 'Não suba o livro inteiro', texto: 'Se a aventura ocupa apenas alguns capítulos de um compêndio, recorte só a parte relevante. Menos texto = melhor resultado.' },
  { numero: 5, titulo: 'Imagens e mapas são separados', texto: 'A IA não lê imagens. Onde havia imagem no PDF, vai aparecer [image]. Apague esses marcadores e suba as imagens pela aba Imagens.' },
  { numero: 6, titulo: 'Revise antes de processar', texto: 'Leia o .md rapidamente antes de mandar para a IA. 2 minutos de revisão evitam muito reprocessamento.' },
  { numero: 7, titulo: 'Stat blocks quebrados', texto: 'Blocos de estatísticas em duas colunas costumam quebrar. Se necessário, cole-os manualmente no final do .md com o cabeçalho ## Apêndice — Estatísticas.' },
]

const tabelaConteudo = [
  { conteudo: 'Texto da aventura (PDF ou .md)', onde: '📖 Aba Aventura' },
  { conteudo: 'Mapas de dungeon, cidade, região', onde: '🗺️ Aba Mapas' },
  { conteudo: 'Retratos de NPCs, monstros, itens', onde: '🖼️ Aba Imagens' },
  { conteudo: 'Handouts para jogadores', onde: '🖼️ Aba Imagens → ativar Compartilhar' },
]

const faqs = [
  { p: 'Minha senha não funciona / esqueci minha senha', r: 'Na tela de login, clique em "Esqueci minha senha". Você receberá um email com o link para redefinir.' },
  { p: 'Posso usar em mais de um dispositivo?', r: 'Sim! O Dungeon Desk funciona no navegador de qualquer dispositivo. Seus dados ficam salvos na nuvem.' },
  { p: 'Meus dados estão seguros?', r: 'Sim. Os dados ficam em servidores seguros (Supabase). Nenhum conteúdo de aventura é compartilhado com outros usuários.' },
  { p: 'Posso ter mais de uma campanha?', r: 'Sim. Crie quantas campanhas quiser. Cada campanha tem seus próprios personagens, aventura, diário e batalhas. Use o seletor no topo da barra lateral para trocar.' },
  { p: 'O que acontece com minha campanha encerrada?', r: 'Ela fica salva no histórico. Em Configurações você pode ver campanhas encerradas e acessar a crônica gerada automaticamente.' },
  { p: 'Posso usar personagens de uma campanha em outra?', r: 'Sim! Na ficha do personagem, use o botão "Copiar para campanha" para criar uma cópia independente em outra campanha.' },
  { p: 'A IA pode errar na leitura da aventura?', r: 'Sim, principalmente em PDFs com layout complexo (duas colunas, tabelas). Recomendamos converter para .md antes para melhor resultado. Você pode editar qualquer campo após o processamento.' },
  { p: 'Quanto custa usar o assistente IA?', r: 'O custo da IA já está incluído no seu plano. Cada plano tem um limite mensal de mensagens mostrado no topo da aba IA.' },
  { p: 'Posso jogar pelo celular?', r: 'O app funciona no navegador do celular, mas é otimizado para tela grande (computador ou tablet). A versão mobile está no roadmap.' },
  { p: 'Como reportar um erro em um monstro/magia/item?', r: 'Em Bestiário, Magias e Itens, há um botão "⚑ Reportar" em cada entrada. Você pode descrever o problema e sugerir a correção.' },
]

// ─── Componente ───────────────────────────────────────────────────────────────

export default function AjudaPage() {
  const [aba, setAba] = useState<'guia' | 'aventuras' | 'faq'>('guia')
  const [guiaAberto, setGuiaAberto] = useState<number | null>(0)
  const [faqAberto, setFaqAberto] = useState<number | null>(null)

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-20">
      <div className="mb-6">
        <h1 className="font-cinzel text-[var(--gold)] text-2xl font-bold mb-1">Central de Ajuda</h1>
        <p className="text-[var(--text3)] font-crimson">Guias, dicas e respostas para o Dungeon Desk</p>
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-6 border-b border-[var(--border)]">
        {([
          { id: 'guia', label: '📖 Guia do App' },
          { id: 'aventuras', label: '🗺️ Guia de Aventuras' },
          { id: 'faq', label: '❓ FAQ' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-cinzel transition-colors border-b-2 -mb-px',
              aba === t.id
                ? 'border-[var(--gold)] text-[var(--gold)]'
                : 'border-transparent text-[var(--text3)] hover:text-[var(--text2)]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Aba 1: Guia do App ── */}
      {aba === 'guia' && (
        <div className="space-y-2">
          {guias.map((g, idx) => (
            <div key={idx} className="border border-[var(--border)] rounded-lg overflow-hidden">
              <button
                onClick={() => setGuiaAberto(guiaAberto === idx ? null : idx)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg2)] hover:bg-[var(--surface)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{g.icone}</span>
                  <div className="text-left">
                    <p className="font-cinzel text-[var(--text)] font-semibold text-sm">{g.titulo}</p>
                    <p className="text-[var(--text3)] text-xs font-crimson">{g.descricao}</p>
                  </div>
                </div>
                <span className={cn('text-[var(--text3)] text-xs transition-transform', guiaAberto === idx ? 'rotate-180' : '')}>▼</span>
              </button>

              {guiaAberto === idx && (
                <div className="bg-[var(--bg)] border-t border-[var(--border)] divide-y divide-[var(--bg3)]">
                  {g.topicos.map((t, ti) => (
                    <div key={ti} className="px-4 py-3">
                      <p className="font-cinzel text-[var(--gold)] text-xs uppercase tracking-wide mb-1">{t.titulo}</p>
                      <p className="text-[var(--text2)] font-crimson text-sm leading-relaxed">{t.texto}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Aba 2: Guia de Aventuras ── */}
      {aba === 'aventuras' && (
        <div className="space-y-6">
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-lg p-4">
            <h2 className="font-cinzel text-[var(--gold)] font-bold mb-2">Qual formato usar?</h2>
            <p className="text-[var(--text2)] font-crimson text-sm mb-4">
              O Dungeon Desk aceita <strong>PDF</strong> (convertemos automaticamente) e <strong>Markdown .md</strong> (melhor qualidade).
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left font-cinzel text-[var(--text3)] text-xs uppercase py-2 pr-4">Tipo de arquivo</th>
                    <th className="text-left font-cinzel text-[var(--text3)] text-xs uppercase py-2 pr-4">Qualidade</th>
                    <th className="text-left font-cinzel text-[var(--text3)] text-xs uppercase py-2">Dica</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--bg3)]">
                  {tiposPDF.map((row, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-[var(--text)] font-crimson">{row.tipo}</td>
                      <td className="py-2 pr-4 text-[var(--text2)] font-crimson whitespace-nowrap">{row.qualidade}</td>
                      <td className="py-2 text-[var(--text3)] font-crimson text-xs">{row.dica}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-lg p-4">
            <h2 className="font-cinzel text-[var(--gold)] font-bold mb-3">O que vai onde?</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left font-cinzel text-[var(--text3)] text-xs uppercase py-2 pr-4">Conteúdo</th>
                    <th className="text-left font-cinzel text-[var(--text3)] text-xs uppercase py-2">Onde subir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--bg3)]">
                  {tabelaConteudo.map((row, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-[var(--text)] font-crimson">{row.conteudo}</td>
                      <td className="py-2 text-[var(--accent2)] font-crimson">{row.onde}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-lg p-4">
            <h2 className="font-cinzel text-[var(--gold)] font-bold mb-3">Como converter para .md (grátis)</h2>
            <div className="space-y-3">
              <div className="border-l-2 border-[var(--accent)] pl-3">
                <p className="font-cinzel text-[var(--accent2)] text-sm">Pelo Dungeon Desk (mais fácil)</p>
                <p className="text-[var(--text2)] font-crimson text-sm">Suba o PDF direto. Convertemos automaticamente. Recomendado para a maioria dos casos.</p>
              </div>
              <div className="border-l-2 border-[var(--border)] pl-3">
                <p className="font-cinzel text-[var(--text2)] text-sm">Pelo Google Drive (grátis)</p>
                <p className="text-[var(--text3)] font-crimson text-sm">1. Faça upload do PDF no Google Drive → 2. Abra com Google Docs → 3. Arquivo → Baixar como .docx → 4. Use Pandoc para converter para .md</p>
              </div>
              <div className="border-l-2 border-[var(--border)] pl-3">
                <p className="font-cinzel text-[var(--text2)] text-sm">Ferramentas online (sem instalar)</p>
                <p className="text-[var(--text3)] font-crimson text-sm">pdf2md.morethan.io · cloudconvert.com</p>
              </div>
              <div className="border-l-2 border-[var(--border)] pl-3">
                <p className="font-cinzel text-[var(--text2)] text-sm">Com pymupdf4llm (técnico)</p>
                <pre className="text-[var(--text3)] font-mono text-xs bg-[var(--bg3)] rounded p-2 mt-1 overflow-x-auto">
                  {`pip install pymupdf4llm\npython -c "import pymupdf4llm; print(pymupdf4llm.to_markdown('aventura.pdf'))" > aventura.md`}
                </pre>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-lg p-4">
            <h2 className="font-cinzel text-[var(--gold)] font-bold mb-3">7 dicas para melhor resultado</h2>
            <div className="space-y-3">
              {dicasAventura.map(d => (
                <div key={d.numero} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--gold)] text-xs font-cinzel font-bold flex-shrink-0 mt-0.5">
                    {d.numero}
                  </span>
                  <div>
                    <p className="font-cinzel text-[var(--text)] text-sm font-semibold">{d.titulo}</p>
                    <p className="text-[var(--text3)] font-crimson text-sm leading-relaxed">{d.texto}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Aba 3: FAQ ── */}
      {aba === 'faq' && (
        <div className="space-y-2">
          {faqs.map((faq, idx) => (
            <div key={idx} className="border border-[var(--border)] rounded-lg overflow-hidden">
              <button
                onClick={() => setFaqAberto(faqAberto === idx ? null : idx)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg2)] hover:bg-[var(--surface)] transition-colors text-left"
              >
                <span className="font-crimson text-[var(--text)] text-sm">{faq.p}</span>
                <span className={cn('text-[var(--text3)] text-xs ml-3 flex-shrink-0 transition-transform', faqAberto === idx ? 'rotate-180' : '')}>▼</span>
              </button>
              {faqAberto === idx && (
                <div className="px-4 py-3 bg-[var(--bg)] border-t border-[var(--border)]">
                  <p className="text-[var(--text2)] font-crimson text-sm leading-relaxed">{faq.r}</p>
                </div>
              )}
            </div>
          ))}

          <div className="mt-6 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-center">
            <p className="font-cinzel text-[var(--text2)] text-sm mb-2">Não encontrou o que procurava?</p>
            <a
              href="/feedback"
              className="inline-block px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent2)] text-white rounded font-cinzel text-sm transition-colors"
            >
              💬 Enviar Feedback
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
