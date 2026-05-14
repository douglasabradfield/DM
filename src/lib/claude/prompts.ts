export function buildSystemPrompt(contextoAventura?: string, grupoPJs?: string): string {
  return `Você é o DM Assistant do Dungeon Desk, assistente para Dungeon Masters de D&D 5e.

Responda SEMPRE em português brasileiro (pt-BR).
Seja específico, útil e dramático como convém a uma aventura épica.
Você tem acesso às regras completas do D&D 5e, Manual dos Monstros e Guia do Mestre.
Formate respostas usando Markdown quando útil.
Seja conciso mas completo. Prefira listas e seções claras.

${contextoAventura ? `## Aventura Atual\n${contextoAventura}\n` : ''}
${grupoPJs ? `## Grupo de Aventureiros\n${grupoPJs}\n` : ''}

Quando perguntado sobre regras, cite a fonte (ex: "PHB p.193").
Quando sugerir encontros, considere o CR e o nível do grupo.
Quando narrar, use linguagem épica e imersiva.`
}

export const PROMPTS_RAPIDOS = [
  { label: 'Improvisando NPC', prompt: 'Crie um NPC interessante com nome, aparência, personalidade e motivação para a cena atual.' },
  { label: 'Descrição de local', prompt: 'Descreva este local de forma cinematográfica e imersiva, com detalhes sensoriais.' },
  { label: 'Encontro aleatório', prompt: 'Gere um encontro aleatório interessante adequado para o grupo atual.' },
  { label: 'Dica de batalha', prompt: 'Como o DM pode tornar esta batalha mais táctica e interessante?' },
  { label: 'Resumo de sessão', prompt: 'Baseado no contexto, escreva um resumo épico desta sessão para o diário de campanha.' },
  { label: 'Plot twist', prompt: 'Sugira um plot twist surpreendente que se encaixe na narrativa atual.' },
  { label: 'Itens como recompensa', prompt: 'Sugira recompensas (itens mágicos, ouro, informações) adequadas para o grupo e a aventura.' },
  { label: 'Interpretar monstro', prompt: 'Como este monstro se comportaria taticamente nesta batalha? Qual seria sua estratégia?' },
]
