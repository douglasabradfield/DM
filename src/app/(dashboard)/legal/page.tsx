export const metadata = { title: 'Legal — Dungeon Desk' }

const secoes = [
  {
    titulo: '📋 Sobre a Plataforma',
    conteudo: `O Dungeon Desk é uma ferramenta de gerenciamento para mestres de RPG de mesa.

A plataforma não distribui, hospeda permanentemente nem reproduz nenhum conteúdo protegido por direitos autorais. Todo arquivo enviado pelo usuário é processado temporariamente para fins de organização e fica vinculado exclusivamente à conta do usuário que o carregou.

O Dungeon Desk funciona como um processador de conteúdo — da mesma forma que um editor de texto ou leitor de PDF — sem interferir na origem ou nos direitos do conteúdo enviado.`,
  },
  {
    titulo: '📜 Conteúdo SRD e Licença CC-BY-4.0',
    conteudo: `As mecânicas de jogo abertas disponíveis na plataforma (monstros, magias, itens, regras) são baseadas no Systems Reference Document 5.2.1 (SRD 5.2.1), licenciado sob Creative Commons Attribution 4.0 International (CC-BY-4.0) pela Wizards of the Coast LLC.

Isso significa que esse conteúdo é livre para uso, adaptação e distribuição, desde que a atribuição seja mantida.

Licença completa: creativecommons.org/licenses/by/4.0`,
  },
  {
    titulo: '👤 Responsabilidade do Usuário',
    conteudo: `Ao fazer upload de qualquer arquivo na plataforma, o usuário declara que:

• Possui os direitos ou licença de uso do conteúdo enviado, OU
• O conteúdo está em domínio público ou sob licença que permite o uso pessoal

A responsabilidade pelo conteúdo carregado é exclusiva do usuário. O Dungeon Desk não verifica nem valida a origem dos arquivos enviados.`,
  },
  {
    titulo: '🔔 Notificação de Violação (DMCA)',
    conteudo: `Se você acredita que algum conteúdo disponível na plataforma viola seus direitos autorais, entre em contato pelo email de suporte com:

• Identificação do conteúdo em questão
• Seus dados de contato
• Declaração de que você é o titular dos direitos

Analisaremos e removeremos o conteúdo em até 72 horas após confirmação da denúncia.`,
  },
  {
    titulo: '⚠️ Isenção de Vínculo',
    conteudo: `O Dungeon Desk não é afiliado, endossado, patrocinado nem aprovado pela Wizards of the Coast LLC, Hasbro Inc. ou qualquer outra editora de RPG.

Dungeons & Dragons e D&D são marcas registradas da Wizards of the Coast LLC.`,
  },
  {
    titulo: '🔒 Privacidade e Dados',
    conteudo: `• Os dados da sua conta (email, personagens, campanhas) ficam armazenados em servidores seguros
• Conteúdo de aventuras é processado pela IA e armazenado vinculado à sua conta
• Não compartilhamos dados pessoais com terceiros
• Você pode solicitar a exclusão completa da sua conta e dados a qualquer momento`,
  },
]

export default function LegalPage() {
  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 pb-20">
      <div className="mb-6">
        <h1 className="font-cinzel text-[var(--gold)] text-2xl font-bold mb-1">Informações Legais</h1>
        <p className="text-[var(--text3)] font-crimson">Termos de uso, licenças e política de privacidade</p>
      </div>

      <div className="space-y-4">
        {secoes.map((s, i) => (
          <div key={i} className="bg-[var(--bg2)] border border-[var(--border)] rounded-lg p-5">
            <h2 className="font-cinzel text-[var(--text)] font-bold mb-3">{s.titulo}</h2>
            <p className="text-[var(--text2)] font-crimson text-sm leading-relaxed whitespace-pre-line">{s.conteudo}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <p className="text-[var(--text3)] text-xs font-cinzel">
          Dungeon Desk · Versão atual · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
