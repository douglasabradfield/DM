import type { Condicao } from '@/types/dnd'
import type { TipoCondicao } from '@/types/batalha'

export const CONDICOES: Condicao[] = [
  {
    id: '1', nome: 'Agarrado', icone: '🤜', sistema: 'dnd5e',
    descricao: 'A criatura está presa por outra.',
    efeitos: ['Velocidade se torna 0', 'Não pode se beneficiar de bônus de velocidade'],
    como_sair: 'A condição termina se o agarrador ficar incapacitado ou se um efeito remover o alvo do alcance do agarrador.',
  },
  {
    id: '2', nome: 'Amedrontado', icone: '😨', sistema: 'dnd5e',
    descricao: 'A criatura está com medo de uma fonte específica.',
    efeitos: ['Desvantagem em testes de habilidade e jogadas de ataque enquanto a fonte do medo estiver em sua linha de visão', 'Não pode se mover voluntariamente em direção à fonte do medo'],
    como_sair: 'Depende do efeito que causou a condição.',
  },
  {
    id: '3', nome: 'Atordoado', icone: '💫', sistema: 'dnd5e',
    descricao: 'A criatura está incapaz de agir normalmente.',
    efeitos: ['Incapacitada e não pode se mover nem falar', 'Falha automaticamente em testes de Força e Destreza', 'Jogadas de ataque contra a criatura têm vantagem'],
    como_sair: 'Depende do efeito que causou a condição.',
  },
  {
    id: '4', nome: 'Cego', icone: '🙈', sistema: 'dnd5e',
    descricao: 'A criatura não pode ver.',
    efeitos: ['Falha automaticamente em qualquer teste que exija visão', 'Jogadas de ataque contra a criatura têm vantagem', 'Jogadas de ataque da criatura têm desvantagem'],
    como_sair: 'Depende do efeito que causou a condição.',
  },
  {
    id: '5', nome: 'Caído', icone: '⬇️', sistema: 'dnd5e',
    descricao: 'A criatura está no chão.',
    efeitos: ['Única opção de movimento é rastejar, exceto se levantar', 'Jogadas de ataque contra a criatura têm vantagem se o atacante estiver a 1,5m, caso contrário desvantagem', 'Jogadas de ataque da criatura têm desvantagem'],
    como_sair: 'A criatura pode usar metade do seu movimento para se levantar.',
  },
  {
    id: '6', nome: 'Concentrado', icone: '🧠', sistema: 'dnd5e',
    descricao: 'A criatura está mantendo concentração em uma magia.',
    efeitos: ['Pode perder concentração se sofrer dano (CD = metade do dano ou 10, o que for maior)', 'Falha automática se incapacitada ou morta'],
    como_sair: 'A criatura pode terminar a concentração voluntariamente. Também termina ao lançar outra magia de concentração.',
  },
  {
    id: '7', nome: 'Encantado', icone: '💜', sistema: 'dnd5e',
    descricao: 'A criatura está encantada por outra.',
    efeitos: ['Não pode atacar o encantador', 'O encantador tem vantagem em testes de habilidade para interagir socialmente com a criatura'],
    como_sair: 'Depende do efeito que causou a condição.',
  },
  {
    id: '8', nome: 'Envenenado', icone: '🤢', sistema: 'dnd5e',
    descricao: 'A criatura está envenenada.',
    efeitos: ['Desvantagem em jogadas de ataque e testes de habilidade'],
    como_sair: 'Depende do veneno. Algumas curas mágicas ou antídotos podem remover.',
  },
  {
    id: '9', nome: 'Exausto', icone: '😴', sistema: 'dnd5e',
    descricao: 'A criatura está exausta (níveis 1-6).',
    efeitos: ['Nível 1: Desvantagem em testes de habilidade', 'Nível 2: Velocidade pela metade', 'Nível 3: Desvantagem em jogadas de ataque e testes de resistência', 'Nível 4: PV máximo pela metade', 'Nível 5: Velocidade se torna 0', 'Nível 6: Morte'],
    como_sair: 'Descanso longo remove um nível de exaustão (com comida e água).',
  },
  {
    id: '10', nome: 'Incapacitado', icone: '🚫', sistema: 'dnd5e',
    descricao: 'A criatura não pode realizar ações ou reações.',
    efeitos: ['Não pode realizar ações', 'Não pode realizar reações'],
    como_sair: 'Depende do efeito que causou a condição.',
  },
  {
    id: '11', nome: 'Inconsciente', icone: '💤', sistema: 'dnd5e',
    descricao: 'A criatura está inconsciente.',
    efeitos: ['Incapacitada e não pode se mover nem falar', 'Cai no chão', 'Falha automaticamente em salvaguardas de Força e Destreza', 'Jogadas de ataque contra ela têm vantagem', 'Qualquer ataque que a acerte é um acerto crítico se o atacante estiver a 1,5m'],
    como_sair: 'Depende do efeito. Dano pode acordar a criatura.',
  },
  {
    id: '12', nome: 'Invisível', icone: '👻', sistema: 'dnd5e',
    descricao: 'A criatura não pode ser vista sem magia especial.',
    efeitos: ['Impossível de localizar por meios normais', 'Jogadas de ataque têm vantagem', 'Jogadas de ataque contra ela têm desvantagem'],
    como_sair: 'Depende do efeito que causou a condição.',
  },
  {
    id: '13', nome: 'Paralisado', icone: '🧊', sistema: 'dnd5e',
    descricao: 'A criatura está completamente paralisada.',
    efeitos: ['Incapacitada e não pode se mover nem falar', 'Falha automaticamente em salvaguardas de Força e Destreza', 'Jogadas de ataque contra ela têm vantagem', 'Qualquer ataque que a acerte a 1,5m é crítico'],
    como_sair: 'Depende do efeito. Geralmente requer magia para remover.',
  },
  {
    id: '14', nome: 'Petrificado', icone: '🗿', sistema: 'dnd5e',
    descricao: 'A criatura foi transformada em pedra.',
    efeitos: ['Transformada em substância sólida inanimada', 'Incapacitada, não pode se mover nem falar', 'Não tem consciência', 'Resistência a todos os danos', 'Imune a veneno e doenças'],
    como_sair: 'Geralmente requer a magia desfazer petrificação ou efeito similar.',
  },
  {
    id: '15', nome: 'Retido', icone: '🕸️', sistema: 'dnd5e',
    descricao: 'A criatura está presa e não consegue se mover.',
    efeitos: ['Velocidade se torna 0', 'Jogadas de ataque contra ela têm vantagem', 'Jogadas de ataque dela têm desvantagem', 'Desvantagem em salvaguardas de Destreza'],
    como_sair: 'Depende do efeito. Pode requerer teste de Força ou Destreza para escapar.',
  },
]

export function getCondicao(nome: TipoCondicao): Condicao | undefined {
  return CONDICOES.find(c => c.nome === nome)
}

export const TODAS_CONDICOES: TipoCondicao[] = [
  'Agarrado', 'Amedrontado', 'Atordoado', 'Cego', 'Caído',
  'Concentrado', 'Encantado', 'Envenenado', 'Exausto', 'Incapacitado',
  'Inconsciente', 'Invisível', 'Paralisado', 'Petrificado', 'Retido'
]
