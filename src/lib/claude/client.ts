import Anthropic from '@anthropic-ai/sdk'

let clienteAnthropic: Anthropic | null = null

export function getClaudeClient(): Anthropic {
  if (!clienteAnthropic) {
    clienteAnthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return clienteAnthropic
}

export const MODELO_CLAUDE = 'claude-sonnet-4-20250514'
