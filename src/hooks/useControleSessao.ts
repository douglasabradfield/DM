'use client'

import { useState } from 'react'
import { useCampanha } from '@/store/campanha'
import { useBatalha } from '@/store/batalha'
import toast from 'react-hot-toast'

// Controle de sessão — sessão é estado da campanha (Fase 3.5), não da
// batalha. Este hook centraliza a lógica (iniciar, encerrar com
// confirmação dupla se houver batalha em andamento) para os dois lugares
// que renderizam o controle: Sidebar (desktop) e Header (mobile). A
// sessão em si já é carregada centralizadamente em Sidebar.tsx.
export function useControleSessao() {
  const { sessaoAtiva, sessaoCarregando, iniciarSessao, encerrarSessao } = useCampanha()
  const statusBatalha = useBatalha(s => s.statusBatalha)
  const encerrarBatalha = useBatalha(s => s.encerrarBatalha)

  const [modalIniciarAberto, setModalIniciarAberto] = useState(false)
  const [encerrando, setEncerrando] = useState(false)

  async function confirmarIniciarSessao(titulo?: string) {
    setModalIniciarAberto(false)
    try {
      const sessao = await iniciarSessao(titulo)
      toast.success(`Sessão ${sessao.numero ?? ''} iniciada!`)
    } catch (e) {
      console.error(e)
      toast.error('Erro ao iniciar sessão')
    }
  }

  async function handleEncerrarSessao() {
    const batalhaAtiva = statusBatalha === 'ativa' || statusBatalha === 'pausada'
    const mensagem = batalhaAtiva
      ? 'Esta sessão tem uma batalha em andamento. Encerrar a sessão também encerra a batalha (o log será salvo no diário). Continuar?'
      : 'Encerrar a sessão?'
    if (!window.confirm(mensagem)) return

    setEncerrando(true)
    try {
      if (batalhaAtiva) await encerrarBatalha()
      await encerrarSessao()
      toast.success('Sessão encerrada')
    } catch (e) {
      console.error(e)
      toast.error('Erro ao encerrar sessão')
    } finally {
      setEncerrando(false)
    }
  }

  return {
    sessaoAtiva,
    sessaoCarregando,
    encerrando,
    modalIniciarAberto,
    abrirModalIniciar: () => setModalIniciarAberto(true),
    fecharModalIniciar: () => setModalIniciarAberto(false),
    confirmarIniciarSessao,
    handleEncerrarSessao,
  }
}
