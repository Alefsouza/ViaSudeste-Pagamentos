import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import { updateColaborador } from '@/services/colaboradores'
import { reconhecimentoFacialService } from '@/services/reconhecimento-facial'
import { createPagamento, updatePagamento } from '@/services/pagamentos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Loader2,
  Search,
  Camera as CameraIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCcw,
  Lock,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { PhotoPreviewModal } from '@/components/PhotoPreviewModal'
import { cn } from '@/lib/utils'
import { fetchPhotoAsBase64 } from '@/lib/photo-cache'

type ViewState =
  | 'EMPTY'
  | 'SEARCHING'
  | 'SEARCH_FAILED'
  | 'CAPTURING'
  | 'PROCESSING'
  | 'RECOGNITION_SUCCESS'
  | 'RECOGNITION_FAILED'
  | 'CONFIRMING_PAYMENT'

export default function Camera() {
  const [registro, setRegistro] = useState('')
  const [viewState, setViewState] = useState<ViewState>('EMPTY')
  const [colaborador, setColaborador] = useState<any>(null)
  const [fotoPredeterminada, setFotoPredeterminada] = useState<string | null>(null)
  const [fotoCapturada, setFotoCapturada] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [blockedDate, setBlockedDate] = useState<string | null>(null)
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false)
  const [fotoBase64, setFotoBase64] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [streamActive, setStreamActive] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)

  const { toast } = useToast()
  const { user } = useAuth()

  const sortedRecords = useMemo(() => {
    if (!colaborador) return []
    const arr =
      colaborador.records && colaborador.records.length > 0
        ? [...colaborador.records]
        : [{ ...colaborador }]
    return arr.sort((a, b) => {
      const parseDate = (dStr: string) => {
        if (!dStr) return 0
        let cleanStr = dStr
        if (cleanStr.includes(' ') && !cleanStr.includes('T')) cleanStr = cleanStr.replace(' ', 'T')
        if (
          !cleanStr.endsWith('Z') &&
          cleanStr.split('T').length === 2 &&
          !cleanStr.includes('+') &&
          !cleanStr.match(/-\d{2}:\d{2}$/)
        ) {
          cleanStr += 'Z'
        }

        const d = new Date(cleanStr)
        if (!isNaN(d.getTime())) return d.getTime()

        const matchIso = dStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (matchIso)
          return new Date(`${matchIso[1]}-${matchIso[2]}-${matchIso[3]}T00:00:00Z`).getTime()
        const matchBr = dStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
        if (matchBr)
          return new Date(`${matchBr[3]}-${matchBr[2]}-${matchBr[1]}T00:00:00Z`).getTime()
        return new Date(dStr).getTime()
      }
      const valA = a.data || a.data_pagamento || a.data_pagamento_v2 || ''
      const valB = b.data || b.data_pagamento || b.data_pagamento_v2 || ''
      const da = parseDate(valA)
      const db = parseDate(valB)
      if (isNaN(da) && isNaN(db)) return String(valA).localeCompare(String(valB))
      if (isNaN(da)) return 1
      if (isNaN(db)) return -1
      return da - db
    })
  }, [colaborador])

  const checkIsLocked = (dataLiberacaoStr?: string) => {
    if (!dataLiberacaoStr) return false

    let cleanStr = dataLiberacaoStr
    if (cleanStr.includes(' ') && !cleanStr.includes('T')) cleanStr = cleanStr.replace(' ', 'T')
    if (
      !cleanStr.endsWith('Z') &&
      cleanStr.split('T').length === 2 &&
      !cleanStr.includes('+') &&
      !cleanStr.match(/-\d{2}:\d{2}$/)
    ) {
      cleanStr += 'Z'
    }

    const libDate = new Date(cleanStr)
    if (isNaN(libDate.getTime())) return false

    const now = new Date()
    return now.getTime() < libDate.getTime()
  }

  const visibleRecords = useMemo(() => {
    const relevantRecords = sortedRecords.filter((r) => {
      // A record is pendente if it hasn't been paid/confirmed (no foto_confirmacao_url or explicitly marked)
      const isPendente = !r.foto_confirmacao_url || r.status === 'Pendente' || r.isExplicitPendente
      const isLiberado = r.liberado_pagamento === true
      const isTimeValid = !checkIsLocked(r.data_liberacao)

      return r.isEligible !== false && isPendente && isLiberado && isTimeValid
    })

    // Just re-sort by date ascending to keep the table chronological
    return relevantRecords.sort((a, b) => {
      const parseDate = (dStr: string) => {
        if (!dStr) return 0
        let cleanStr = dStr
        if (cleanStr.includes(' ') && !cleanStr.includes('T')) cleanStr = cleanStr.replace(' ', 'T')
        if (
          !cleanStr.endsWith('Z') &&
          cleanStr.split('T').length === 2 &&
          !cleanStr.includes('+') &&
          !cleanStr.match(/-\d{2}:\d{2}$/)
        ) {
          cleanStr += 'Z'
        }

        const d = new Date(cleanStr)
        if (!isNaN(d.getTime())) return d.getTime()

        const matchIso = dStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (matchIso)
          return new Date(`${matchIso[1]}-${matchIso[2]}-${matchIso[3]}T00:00:00Z`).getTime()
        const matchBr = dStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
        if (matchBr)
          return new Date(`${matchBr[3]}-${matchBr[2]}-${matchBr[1]}T00:00:00Z`).getTime()
        return new Date(dStr).getTime()
      }
      const da = parseDate(a.data || a.data_pagamento || a.data_pagamento_v2 || '')
      const db = parseDate(b.data || b.data_pagamento || b.data_pagamento_v2 || '')
      return da - db
    })
  }, [sortedRecords])

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
      setStreamActive(false)
      setCameraReady(false)
    }
  }, [])

  const startCamera = useCallback(async () => {
    if (videoRef.current && videoRef.current.srcObject) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setStreamActive(true)
      }
    } catch (err) {
      setErrorMsg('Câmera não encontrada. Verifique se está conectada')
    }
  }, [])

  const isCameraActive = [
    'CAPTURING',
    'PROCESSING',
    'RECOGNITION_SUCCESS',
    'RECOGNITION_FAILED',
    'CONFIRMING_PAYMENT',
  ].includes(viewState)

  useEffect(() => {
    setBlockedDate(null)
  }, [colaborador])

  useEffect(() => {
    if (isCameraActive) {
      startCamera()
    } else {
      stopCamera()
    }
  }, [isCameraActive, startCamera, stopCamera])

  const fetchColaboradorSilent = useCallback(async () => {
    if (!registro) return
    try {
      const records = await pb
        .collection('colaboradores')
        .getFullList({ filter: `registro = "${registro}"` })
      if (records && records.length > 0) {
        setColaborador({
          registro: records[0].registro,
          nome: records[0].nome,
          filial: records[0].filial,
          records: records,
        })
      }
    } catch (err) {
      // Silent fail, keep current view
    }
  }, [registro])

  useRealtime(
    'colaboradores',
    (e) => {
      if (colaborador && e.record.registro === colaborador.registro) {
        fetchColaboradorSilent()
      }
    },
    !!colaborador,
  )

  useRealtime(
    'pagamentos',
    (e) => {
      if (colaborador && e.record.registro === colaborador.registro) {
        fetchColaboradorSilent()
      } else if (
        colaborador &&
        e.record.colaborador_id &&
        colaborador.all_records_ids?.includes(e.record.colaborador_id)
      ) {
        fetchColaboradorSilent()
      }
    },
    !!colaborador,
  )

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    setViewState('SEARCHING')
    setErrorMsg(null)
    setColaborador(null)
    setFotoPredeterminada(null)
    setFotoCapturada(null)

    try {
      const records = await pb.collection('colaboradores').getFullList({
        filter: `registro = "${registro}"`,
      })

      if (!records || records.length === 0) {
        const msg = 'Não há pagamento para esse colaborador.'
        setViewState('SEARCH_FAILED')
        setErrorMsg(msg)
        toast({ title: 'Aviso', description: msg, variant: 'destructive' })
        return
      }

      const hasLiberado = records.some((r) => r.liberado_pagamento === true)
      const hasPendente = records.some((r) => !r.foto_confirmacao_url || r.status === 'Pendente')
      const hasValidTime = records.some((r) => !checkIsLocked(r.data_liberacao))

      const availableRecords = records.filter((r) => {
        const isPendente =
          !r.foto_confirmacao_url || r.status === 'Pendente' || r.isExplicitPendente
        const isLiberado = r.liberado_pagamento === true
        const isTimeValid = !checkIsLocked(r.data_liberacao)
        return isPendente && isLiberado && isTimeValid
      })

      if (availableRecords.length === 0) {
        const msg = 'Não há pagamento para esse colaborador.'

        setViewState('SEARCH_FAILED')
        setErrorMsg(msg)
        toast({ title: 'Aviso', description: msg, variant: 'destructive' })
        return
      }

      let fotoUrl = null
      try {
        const fotoRecord = await pb
          .collection('fotos_colaboradores')
          .getFirstListItem(`registro = "${registro}"`)
        if (fotoRecord && fotoRecord.foto) {
          fotoUrl = pb.files.getURL(fotoRecord, fotoRecord.foto)
        } else if (fotoRecord && fotoRecord.foto_url) {
          fotoUrl = fotoRecord.foto_url
        }
      } catch (err) {
        // No photo found
      }

      setColaborador({
        registro: records[0].registro,
        nome: records[0].nome,
        filial: records[0].filial,
        records: records,
      })
      setFotoPredeterminada(fotoUrl)
      setFotoBase64(null)
      setViewState('CAPTURING')

      if (fotoUrl) {
        fetchPhotoAsBase64(fotoUrl, registro)
          .then((b64) => {
            if (b64) setFotoBase64(b64)
          })
          .catch(() => {})
      }
    } catch (err: any) {
      setViewState('SEARCH_FAILED')
      const msg = err.message || 'Erro ao buscar dados do colaborador'
      setErrorMsg(msg)
      toast({
        title: 'Aviso',
        description: msg,
        variant: 'destructive',
      })
    }
  }

  const formatDateSafe = (dStr?: string) => {
    if (!dStr) return 'Data não informada'

    const trimmed = dStr.trim()

    // Brazilian date format: dd/mm/yyyy — return as-is (already correct)
    const matchBr = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (matchBr) {
      const dd = matchBr[1].padStart(2, '0')
      const mm = matchBr[2].padStart(2, '0')
      const yyyy = matchBr[3]
      return `${dd}/${mm}/${yyyy}`
    }

    // ISO date-only: YYYY-MM-DD — convert directly without Date object (avoids timezone shift)
    const matchIsoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (matchIsoDate) {
      return `${matchIsoDate[3]}/${matchIsoDate[2]}/${matchIsoDate[1]}`
    }

    // ISO datetime: extract date portion directly to avoid timezone issues
    const matchIsoDateTime = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]/)
    if (matchIsoDateTime) {
      return `${matchIsoDateTime[3]}/${matchIsoDateTime[2]}/${matchIsoDateTime[1]}`
    }

    // Fallback: try Date object with UTC methods (no timezone subtraction)
    let cleanStr = trimmed
    if (cleanStr.includes(' ') && !cleanStr.includes('T')) cleanStr = cleanStr.replace(' ', 'T')
    if (
      !cleanStr.endsWith('Z') &&
      cleanStr.split('T').length === 2 &&
      !cleanStr.includes('+') &&
      !cleanStr.match(/-\d{2}:\d{2}$/)
    ) {
      cleanStr += 'Z'
    }
    const d = new Date(cleanStr)
    if (!isNaN(d.getTime())) {
      const dd = String(d.getUTCDate()).padStart(2, '0')
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
      const yyyy = d.getUTCFullYear()
      return `${dd}/${mm}/${yyyy}`
    }

    return dStr
  }

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '--:--'
    if (timeStr.length === 4 && !timeStr.includes(':')) {
      return `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}`
    }
    if (timeStr.includes('T') || timeStr.includes(' ')) {
      const date = new Date(timeStr)
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      }
      const timeMatch = timeStr.match(/\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b/)
      if (timeMatch) return timeMatch[0]
    }
    const parts = timeStr.split(':')
    if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
    return timeStr
  }

  const formatHoras = (horas?: number | string) => {
    if (horas === undefined || horas === null || horas === '') return '00.00'
    const num = typeof horas === 'string' ? parseFloat(horas) : horas
    if (isNaN(num)) return '00.00'
    return num.toFixed(2).padStart(5, '0')
  }

  const calcularIntervaloHoras = (
    inicio?: string,
    termino?: string,
    fallbackHoras?: number | string,
  ) => {
    const fInicio = formatTime(inicio)
    const fTermino = formatTime(termino)

    if (fInicio !== '--:--' && fTermino !== '--:--') {
      const [h1, m1] = fInicio.split(':').map(Number)
      const [h2, m2] = fTermino.split(':').map(Number)

      if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
        let startMin = h1 * 60 + m1
        let endMin = h2 * 60 + m2
        if (endMin < startMin) endMin += 24 * 60 // cross midnight

        const diffHoras = (endMin - startMin) / 60
        return diffHoras.toFixed(2).padStart(5, '0')
      }
    }
    return formatHoras(fallbackHoras)
  }

  const getTipoPagamentoDesc = (idtipopgto?: number | string) => {
    const id = typeof idtipopgto === 'string' ? parseInt(idtipopgto, 10) : idtipopgto
    switch (id) {
      case 1:
        return 'Hora Extra'
      case 3:
        return 'Ferias Trabalhada'
      case 4:
        return 'Vale Refeicao'
      default:
        return 'Tipo desconhecido'
    }
  }

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || !fotoPredeterminada) return

    setViewState('PROCESSING')
    setErrorMsg(null)

    setTimeout(async () => {
      try {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas) return

        const context = canvas.getContext('2d')
        if (!context) return

        canvas.width = 360
        canvas.height = 360

        const size = Math.min(video.videoWidth, video.videoHeight)
        const startX = (video.videoWidth - size) / 2
        const startY = (video.videoHeight - size) / 2

        context.drawImage(video, startX, startY, size, size, 0, 0, 360, 360)

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.5),
        )
        if (!blob) throw new Error('Falha na compressão da imagem')

        const fotoCaptured = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        setFotoCapturada(fotoCaptured)

        const success = await reconhecimentoFacialService(
          fotoPredeterminada,
          fotoCaptured,
          colaborador?.registro,
          fotoBase64 || undefined,
        )

        if (success) {
          setViewState('RECOGNITION_SUCCESS')
          setErrorMsg(null)
        } else {
          setViewState('RECOGNITION_FAILED')
          setErrorMsg('Rosto não corresponde ao registro informado')
        }
      } catch (err: any) {
        setViewState('RECOGNITION_FAILED')
        if (
          err.message &&
          err.message !== 'Unknown error' &&
          err.message !== 'Something went wrong.'
        ) {
          setErrorMsg(err.message)
        } else if (err.status === 401) {
          setErrorMsg('Credenciais da AWS inválidas. Verifique Secrets')
        } else if (err.status === 403) {
          setErrorMsg('Região da AWS inválida. Verifique Secrets')
        } else if (err.status === 429) {
          setErrorMsg('Limite de requisições atingido. Tente novamente')
        } else if (err.status === 504) {
          setErrorMsg('Timeout ao processar reconhecimento. Tente novamente')
        } else if (err.status === 500) {
          setErrorMsg('Serviço da AWS indisponível. Tente novamente')
        } else {
          setErrorMsg('Erro ao processar foto. Tente capturar novamente')
        }
      }
    }, 10)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const handleConfirmPayment = async () => {
    if (!colaborador) return

    if (!fotoCapturada) {
      toast({
        title: 'Erro',
        description: 'Nenhuma foto capturada encontrada. Tente novamente',
        variant: 'destructive',
      })
      setViewState('RECOGNITION_SUCCESS')
      return
    }

    setViewState('CONFIRMING_PAYMENT')
    let file: File | undefined

    try {
      const response = await fetch(fotoCapturada)
      const blob = await response.blob()
      const timestamp = Date.now()
      const fileName = `${colaborador.registro}_${timestamp}.jpg`
      file = new File([blob], fileName, { type: 'image/jpeg' })
    } catch (error) {
      console.error('Erro ao converter foto capturada:', error)
    }

    if (!file) {
      toast({
        title: 'Erro',
        description: 'Erro ao processar foto capturada. Tente novamente',
        variant: 'destructive',
      })
      setViewState('RECOGNITION_SUCCESS')
      return
    }

    const now = new Date()
    const data_pagamento = now.toISOString()
    const utcMinus3 = new Date(now.getTime() - 3 * 3600000)
    const pad = (n: number) => n.toString().padStart(2, '0')
    const hora_pagamento = `${pad(utcMinus3.getUTCHours())}:${pad(utcMinus3.getUTCMinutes())}`

    if (visibleRecords.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Não há pagamentos liberados para processar.',
        variant: 'destructive',
      })
      setViewState('RECOGNITION_SUCCESS')
      return
    }

    try {
      // Re-validate to ensure backend consistency and prevent bypassing
      const validationRecords = await pb.collection('colaboradores').getFullList({
        filter: `registro = "${colaborador.registro}"`,
      })
      const currentValidRecordsIds = new Set(
        validationRecords
          .filter((r: any) => {
            const isPendente =
              !r.foto_confirmacao_url || r.status === 'Pendente' || r.isExplicitPendente
            const isLiberado = r.liberado_pagamento === true
            const isTimeValid = !checkIsLocked(r.data_liberacao)
            return r.isEligible !== false && isPendente && isLiberado && isTimeValid
          })
          .map((r: any) => r.id),
      )

      const recordsToProcess = visibleRecords.filter((r) => currentValidRecordsIds.has(r.id))

      if (recordsToProcess.length === 0) {
        toast({
          title: 'Aviso',
          description: 'Os pagamentos selecionados não estão mais disponíveis para processamento.',
          variant: 'destructive',
        })
        setViewState('RECOGNITION_SUCCESS')
        return
      }

      let firstFileUrl = ''

      for (let i = 0; i < recordsToProcess.length; i++) {
        const record = recordsToProcess[i]

        const parsedHoras =
          typeof record.horas === 'string' ? parseFloat(record.horas) : record.horas
        const validHoras =
          typeof parsedHoras === 'number' && !isNaN(parsedHoras) ? parsedHoras : undefined

        const parsedIdTipoPgto =
          typeof record.idtipopgto === 'string'
            ? parseInt(record.idtipopgto, 10)
            : record.idtipopgto
        const validIdTipoPgto =
          typeof parsedIdTipoPgto === 'number' && !isNaN(parsedIdTipoPgto)
            ? parsedIdTipoPgto
            : undefined

        const dataToSave: any = {
          colaborador_id: record.id,
          valor_pago: record.valor_a_receber || record.valor || 0,
          data_pagamento,
          hora_pagamento,
          user_id: user?.id,
          status: 'Confirmado',
          inicio: record.inicio,
          termino: record.termino,
          horas: validHoras,
          idtipopgto: validIdTipoPgto,
          tipo_pagamento: getTipoPagamentoDesc(record.idtipopgto),
          registro: record.registro,
          nome: record.nome,
          filial: record.filial_id ? Number(record.filial_id) : undefined,
        }

        if (i === 0) {
          dataToSave.foto_confirmacao = file
        } else if (firstFileUrl) {
          dataToSave.foto_confirmacao_url = firstFileUrl
        }

        let pagamentoRecord
        if (record.pagamento_id) {
          pagamentoRecord = await updatePagamento(record.pagamento_id, dataToSave)
        } else {
          pagamentoRecord = await createPagamento(dataToSave)
        }

        if (i === 0) {
          firstFileUrl = pb.files.getURL(pagamentoRecord, pagamentoRecord.foto_confirmacao)
          await updatePagamento(pagamentoRecord.id, { foto_confirmacao_url: firstFileUrl })
        }
      }

      try {
        const idsToUpdate = recordsToProcess.map((r) => r.id)
        for (const id of idsToUpdate) {
          await updateColaborador(id, { foto_confirmacao_url: firstFileUrl })
        }
      } catch (err) {
        toast({
          title: 'Aviso',
          description: 'Pagamento confirmado, mas erro ao atualizar colaborador(es).',
          variant: 'destructive',
        })
        handleReset()
        return
      }

      const totalPago = recordsToProcess.reduce(
        (acc: number, rec: any) => acc + (rec.valor_a_receber || rec.valor || 0),
        0,
      )

      toast({
        title: 'Sucesso',
        description: `Pagamento confirmado para ${colaborador.nome} no valor de ${formatCurrency(totalPago)}`,
      })
      handleReset()
    } catch (err: any) {
      console.error(err)
      const msg =
        err?.message && !err?.message.includes('400')
          ? err.message
          : 'Erro ao confirmar pagamento. Verifique a conexão e tente novamente.'
      toast({
        title: 'Erro de processamento',
        description: msg,
        variant: 'destructive',
      })
      setViewState('RECOGNITION_SUCCESS')
    }
  }

  const handleReset = () => {
    setRegistro('')
    setColaborador(null)
    setFotoPredeterminada(null)
    setFotoBase64(null)
    setFotoCapturada(null)
    setErrorMsg(null)
    setViewState('EMPTY')
  }

  const handleRetry = () => {
    setColaborador(null)
    setFotoPredeterminada(null)
    setFotoBase64(null)
    setFotoCapturada(null)
    setErrorMsg(null)
    setViewState('EMPTY')
  }

  return (
    <div className="container max-w-5xl mx-auto p-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Pagamento
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Identifique o colaborador e realize a verificação facial.
        </p>
      </div>

      <div className="grid md:grid-cols-12 gap-4 h-auto md:h-[513px]">
        {/* Left Column */}
        <div className="md:col-span-5 h-full">
          <div className="flex flex-col gap-4 h-full">
            <Card className="shrink-0 border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Busca de Funcionário</CardTitle>
                <CardDescription>Insira o número de registro para localizar.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="registro" className="text-slate-700 dark:text-slate-300">
                      Registro
                    </Label>
                    <Input
                      id="registro"
                      placeholder="Ex: 12345"
                      value={registro}
                      onChange={(e) => setRegistro(e.target.value)}
                      className="border-slate-200 dark:border-slate-800"
                      disabled={
                        viewState !== 'EMPTY' &&
                        viewState !== 'SEARCH_FAILED' &&
                        viewState !== 'RECOGNITION_FAILED'
                      }
                    />
                  </div>
                  {(viewState === 'SEARCH_FAILED' || errorMsg) && (
                    <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 dark:text-red-400 p-3 rounded-md">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="leading-snug">
                        {viewState === 'SEARCH_FAILED' && !errorMsg
                          ? 'Não há valor para o colaborador receber'
                          : errorMsg}
                      </span>
                    </div>
                  )}
                  {viewState === 'SEARCH_FAILED' ? (
                    <Button
                      type="button"
                      className="w-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 h-10"
                      onClick={handleRetry}
                    >
                      Tentar Novamente
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      className="w-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 h-10"
                      disabled={viewState === 'SEARCHING' || viewState === 'PROCESSING'}
                    >
                      {viewState === 'SEARCHING' ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Buscando...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Buscar
                        </>
                      )}
                    </Button>
                  )}
                  {viewState !== 'EMPTY' &&
                    viewState !== 'SEARCHING' &&
                    viewState !== 'SEARCH_FAILED' && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-10 mt-2 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                        onClick={handleReset}
                        disabled={viewState === 'PROCESSING'}
                      >
                        Nova Busca
                      </Button>
                    )}
                </form>
              </CardContent>
            </Card>

            {colaborador && (
              <Card className="shrink-0 border-slate-200 dark:border-slate-800 shadow-sm rounded-xl animate-in fade-in duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-md">Perfil</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    {fotoPredeterminada ? (
                      <button
                        type="button"
                        onClick={() => setPhotoPreviewOpen(true)}
                        className="w-14 h-14 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0 cursor-pointer transition-transform duration-200 hover:scale-105 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        title="Clique para ampliar a foto"
                      >
                        <img
                          src={fotoPredeterminada}
                          alt="Foto"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <CameraIcon className="h-5 w-5 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {colaborador.nome}
                      </p>
                      <p className="text-sm text-slate-500">Reg: {colaborador.registro}</p>
                      <p className="text-sm text-slate-500">{colaborador.filial}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right Column - Camera */}
        <div className="md:col-span-7 h-full min-h-[400px] md:min-h-0">
          <Card className="h-full relative overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
            {isCameraActive && !streamActive && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                <Loader2 className="h-8 w-8 text-slate-400 animate-spin" />
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
                isCameraActive ? 'opacity-100' : 'opacity-0',
              )}
            />
            <canvas ref={canvasRef} className="hidden" />

            {(!isCameraActive ||
              viewState === 'EMPTY' ||
              viewState === 'SEARCHING' ||
              viewState === 'SEARCH_FAILED') && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500">
                <CameraIcon className="h-8 w-8 mb-4 text-slate-400" />
                <p className="text-sm">A câmera será ativada após a busca.</p>
              </div>
            )}

            {viewState === 'PROCESSING' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 text-slate-900 dark:text-white animate-spin mb-4" />
                <p className="text-sm font-medium text-slate-900 dark:text-white">Processando...</p>
              </div>
            )}

            {(viewState === 'RECOGNITION_SUCCESS' || viewState === 'CONFIRMING_PAYMENT') && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm">
                {viewState === 'CONFIRMING_PAYMENT' ? (
                  <>
                    <Loader2 className="h-8 w-8 text-slate-900 dark:text-white animate-spin mb-4" />
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Confirmando pagamento...
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-500" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                      Reconhecimento Concluído
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Verifique os dados no resumo.</p>
                  </>
                )}
              </div>
            )}

            {viewState === 'RECOGNITION_FAILED' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm px-6 text-center">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  Reconhecimento Falhou
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                  {errorMsg || 'Rosto não corresponde ao registro.'}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewState('CAPTURING')
                    setErrorMsg(null)
                  }}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Tentar Novamente
                </Button>
              </div>
            )}

            {viewState === 'CAPTURING' && (
              <div className="absolute inset-0 z-10 flex flex-col justify-end p-6">
                <div className="flex justify-center">
                  <Button
                    size="lg"
                    className="rounded-full h-16 w-16 p-0 border border-slate-200 bg-white/90 hover:bg-white text-slate-900 shadow-sm backdrop-blur-sm transition-all"
                    onClick={handleCapture}
                  >
                    <CameraIcon className="h-6 w-6" />
                    <span className="sr-only">Capturar Foto</span>
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Resumo Modal */}
      <Dialog
        open={viewState === 'RECOGNITION_SUCCESS' || viewState === 'CONFIRMING_PAYMENT'}
        onOpenChange={(open) => {
          if (!open && viewState !== 'CONFIRMING_PAYMENT') handleReset()
        }}
      >
        <DialogContent
          className="w-[95vw] max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden p-4 sm:p-6 [&>button]:hidden"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>Resumo do Pagamento</DialogTitle>
            <DialogDescription>
              Confirme os detalhes do pagamento para o colaborador identificado.
            </DialogDescription>
          </DialogHeader>

          {colaborador && visibleRecords.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-lg min-h-[300px]">
              <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                Não há pagamentos liberados.
              </h3>
              <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
                Não há pagamentos disponíveis para processamento no momento.
              </p>
            </div>
          )}

          {colaborador && visibleRecords.length > 0 && (
            <div className="flex flex-col min-h-0 gap-4 mt-2">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg shrink-0">
                <div>
                  <p className="text-xs text-slate-500">Registro</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {colaborador.registro}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Nome</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {colaborador.nome}
                  </p>
                </div>
              </div>

              <div className="border rounded-md overflow-auto flex-1 min-h-0 bg-white dark:bg-slate-950">
                <Table className="min-w-[700px] text-sm relative">
                  <TableHeader className="sticky top-0 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-sm z-10 shadow-sm">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="py-2 h-8 text-xs font-semibold">Data</TableHead>
                      <TableHead className="py-2 h-8 text-xs font-semibold">Início</TableHead>
                      <TableHead className="py-2 h-8 text-xs font-semibold">Término</TableHead>
                      <TableHead className="py-2 h-8 text-xs font-semibold">
                        Total (Horas)
                      </TableHead>
                      <TableHead className="py-2 h-8 text-xs font-semibold">
                        Tipo de Pagamento
                      </TableHead>
                      <TableHead className="py-2 h-8 text-xs font-semibold text-right">
                        Valor
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRecords.map((record: any, idx: number) => (
                      <TableRow
                        key={record.id || idx}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <TableCell className="py-1.5 leading-tight text-slate-700 dark:text-slate-300">
                          {formatDateSafe(
                            record.data || record.data_pagamento || record.data_pagamento_v2,
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 leading-tight text-slate-700 dark:text-slate-300">
                          {formatTime(record.inicio)}
                        </TableCell>
                        <TableCell className="py-1.5 leading-tight text-slate-700 dark:text-slate-300">
                          {formatTime(record.termino)}
                        </TableCell>
                        <TableCell className="py-1.5 leading-tight text-slate-700 dark:text-slate-300">
                          {calcularIntervaloHoras(record.inicio, record.termino, record.horas)}
                        </TableCell>
                        <TableCell className="py-1.5 leading-tight text-slate-700 dark:text-slate-300">
                          {getTipoPagamentoDesc(record.idtipopgto)}
                        </TableCell>
                        <TableCell className="py-1.5 leading-tight text-right font-medium text-slate-900 dark:text-slate-100">
                          {formatCurrency(record.valor_a_receber || record.valor || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end shrink-0 pt-2">
                <div className="w-full md:w-1/3 space-y-2">
                  <div className="border-b pb-2 space-y-1">
                    <h4 className="font-medium text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Subtotais por Tipo
                    </h4>
                    {Object.entries(
                      visibleRecords.reduce((acc: any, record: any) => {
                        const type = getTipoPagamentoDesc(record.idtipopgto)
                        const val = record.valor_a_receber || record.valor || 0
                        acc[type] = (acc[type] || 0) + val
                        return acc
                      }, {}),
                    ).map(([type, total]: any) => (
                      <div key={type} className="flex justify-between text-xs">
                        <span className="text-slate-500">{type}</span>
                        <span className="font-medium">{formatCurrency(total)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="font-bold text-sm">Total Geral</span>
                    <span className="font-bold text-lg text-green-600 dark:text-green-500">
                      {formatCurrency(
                        visibleRecords.reduce(
                          (acc: number, rec: any) => acc + (rec.valor_a_receber || rec.valor || 0),
                          0,
                        ),
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 shrink-0 w-full flex flex-row justify-between sm:justify-between space-x-0 sm:space-x-0 gap-4">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={viewState === 'CONFIRMING_PAYMENT'}
              className="flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmPayment}
              disabled={viewState === 'CONFIRMING_PAYMENT' || visibleRecords.length === 0}
              className="flex-1 sm:flex-none"
            >
              {viewState === 'CONFIRMING_PAYMENT' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PhotoPreviewModal
        open={photoPreviewOpen}
        onOpenChange={setPhotoPreviewOpen}
        fotoUrl={fotoPredeterminada}
        registro={colaborador?.registro || ''}
        nome={colaborador?.nome || ''}
      />
    </div>
  )
}
