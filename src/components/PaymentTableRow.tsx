import { memo } from 'react'
import { TableRow, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Lock, Unlock, Trash2, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatBRL,
  getTipoPagamento,
  formatDateTimeBR,
  getPaymentDisplayDate,
  formatDateDBToBR,
  checkIsLocked,
} from '@/lib/formatters'

function getEvaluatedStatus(curr: any, maxRef: number): string {
  if (curr.pagamento_relacionado?.status === 'Cancelado') return 'Cancelado'
  if (curr.pagamento_relacionado?.status === 'Confirmado') return 'Confirmado'
  let status = curr.foto_confirmacao_url ? 'Confirmado' : 'Pendente'
  const liberadoPagamento = curr.liberado_pagamento
  const dataLiberacao = curr.data_liberacao
  const ref = curr.referencia || 0
  if (status === 'Pendente') {
    const isLocked = checkIsLocked(dataLiberacao)
    const isOutsideWindow = ref > 0 && maxRef > 0 && ref < maxRef - 3
    if (isLocked) status = 'Agendado'
    else if (isOutsideWindow && !liberadoPagamento) status = 'Bloqueado'
  }
  return status
}

function getActualValue(curr: any): number {
  if (curr.pagamento_relacionado?.status === 'Confirmado') {
    return curr.pagamento_relacionado.valor_pago || 0
  }
  return curr.valor_a_receber || curr.valor || 0
}

interface PaymentTableRowProps {
  record: any
  maxRef: number
  canManagePayments: boolean
  onPhotoClick: (url: string) => void
  onToggleRelease: (record: any) => void
  onDeleteClick: (record: any) => void
}

function PaymentTableRowComponent({
  record: p,
  maxRef,
  canManagePayments,
  onPhotoClick,
  onToggleRelease,
  onDeleteClick,
}: PaymentTableRowProps) {
  const isGrouped = p._isGrouped === true
  const status = getEvaluatedStatus(p, maxRef)
  const actualRef = p.referencia
  const isOutsideValidity = actualRef && maxRef > 0 && actualRef < maxRef - 3
  const liberadoPagamento = p.liberado_pagamento
  const displayDate = getPaymentDisplayDate(p)

  const filialDisplay = isGrouped
    ? p.filiais.join(', ')
    : p.filial === 2
      ? 'Cursino'
      : p.filial === 4
        ? 'Sapopemba'
        : p.filial || '-'

  const refDisplay = isGrouped
    ? p.referencias.length > 0
      ? p.referencias.join(', ')
      : '-'
    : (p.referencia ?? '-')

  return (
    <TableRow>
      <TableCell className="font-medium pl-8">
        {isGrouped ? (
          <div className="space-y-0.5">
            {p.nomes.map((nome: string, i: number) => (
              <div key={i} className="truncate">
                {nome}
              </div>
            ))}
          </div>
        ) : (
          p.nome || 'Desconhecido'
        )}
      </TableCell>
      <TableCell>{isGrouped ? p.registros.join(', ') : p.registro || '-'}</TableCell>
      <TableCell>{filialDisplay}</TableCell>
      <TableCell className="whitespace-nowrap">{refDisplay}</TableCell>
      <TableCell className="text-emerald-600 dark:text-emerald-500 font-medium text-left">
        {formatBRL(getActualValue(p))}
      </TableCell>
      <TableCell>
        {isGrouped ? (
          <div className="space-y-0.5">
            {p.tipos_pagamento.map((tipo: string, i: number) => (
              <div key={i}>{tipo}</div>
            ))}
          </div>
        ) : (
          getTipoPagamento(p.idtipopgto)
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {displayDate ? formatDateTimeBR(displayDate) : '-'}
      </TableCell>
      <TableCell>
        {status === 'Confirmado' && (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">Confirmado</Badge>
        )}
        {status === 'Agendado' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="cursor-help">
                <Badge className="bg-slate-400 hover:bg-slate-500 text-white flex items-center gap-1 w-max">
                  <Lock className="w-3 h-3" />
                  Agendado
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Liberado em: {formatDateDBToBR(p.data_liberacao)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {status === 'Bloqueado' && (
          <Badge className="bg-rose-500 hover:bg-rose-600 text-white flex items-center gap-1 w-max">
            <Lock className="w-3 h-3" />
            Bloqueado
          </Badge>
        )}
        {status === 'Pendente' && (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Pendente</Badge>
        )}
        {status === 'Cancelado' && <Badge variant="destructive">Cancelado</Badge>}
        {!['Confirmado', 'Agendado', 'Bloqueado', 'Pendente', 'Cancelado'].includes(status) && (
          <Badge variant="outline">{status}</Badge>
        )}
      </TableCell>
      <TableCell className="text-center">
        {p.foto_confirmacao_url && (
          <Button variant="ghost" size="sm" onClick={() => onPhotoClick(p.foto_confirmacao_url)}>
            <ImageIcon className="w-4 h-4 mr-2" />
            Visualizar
          </Button>
        )}
      </TableCell>
      {canManagePayments && (
        <TableCell className="text-center">
          {isGrouped ? (
            <Badge variant="secondary" className="text-xs">
              {p._groupCount} pagamentos
            </Badge>
          ) : (
            <div className="flex justify-center gap-1">
              {(status === 'Pendente' || status === 'Bloqueado') && isOutsideValidity && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'hover:bg-amber-100 dark:hover:bg-amber-900/50',
                    liberadoPagamento
                      ? 'text-emerald-500 hover:text-emerald-700'
                      : 'text-amber-500 hover:text-amber-700',
                  )}
                  onClick={() => onToggleRelease(p)}
                  title={liberadoPagamento ? 'Bloquear Pagamento' : 'Liberar Pagamento'}
                >
                  {liberadoPagamento ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <Unlock className="h-4 w-4" />
                  )}
                </Button>
              )}
              {(status === 'Pendente' || status === 'Bloqueado' || status === 'Agendado') && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/50"
                  onClick={() => onDeleteClick(p)}
                  title="Excluir Pagamento"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </TableCell>
      )}
    </TableRow>
  )
}

export const PaymentTableRow = memo(PaymentTableRowComponent)
