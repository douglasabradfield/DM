// Esconde a parte comercial (planos, preços, "Assinar", upgrade) da interface.
// Só visual e reversível: plano, limites e /api/stripe seguem funcionando.
// Voltar a exibir = NEXT_PUBLIC_ASSINATURA_VISIVEL=true.
export const ASSINATURA_VISIVEL = process.env.NEXT_PUBLIC_ASSINATURA_VISIVEL === 'true'

export const MSG_LIMITE_PLANO = 'Limite do seu plano atingido. Fale com o administrador.'
