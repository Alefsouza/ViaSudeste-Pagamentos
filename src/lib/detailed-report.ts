import { formatBRL, formatDateDBToBR } from '@/lib/formatters'
import type { DetalhadaItem } from '@/services/export-folha-detalhada'

export function generateDetailedPDF(
  items: DetalhadaItem[],
  total: number,
  registro: string,
  nome: string,
  inicio: string,
  fim: string,
): boolean {
  const printWindow = window.open('', '_blank', 'width=800,height=600')
  if (!printWindow) return false

  const rowsHtml = items
    .map(
      (item, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="text-align: center;">${item.competencia}</td>
        <td style="text-align: right;">${formatBRL(item.valor_calculado)}</td>
      </tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Detalhado de Pagamentos</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; padding: 20px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 16px; font-weight: bold; }
    .header h2 { font-size: 14px; font-weight: bold; margin-top: 5px; }
    .info-section { margin-bottom: 15px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
    .info-label { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th, td { border: 1px solid #000; padding: 4px 8px; font-size: 11px; }
    th { background-color: #f0f0f0; font-weight: bold; text-align: center; }
    .total-section { margin-top: 10px; text-align: right; }
    .total-row { display: inline-block; border: 2px solid #000; padding: 8px 16px; font-size: 14px; font-weight: bold; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #000; font-size: 10px; text-align: justify; }
    .footer-note { font-style: italic; }
    @media print { body { padding: 10px; } @page { size: A4; margin: 10mm; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>VIA SUDESTE TRANSPORTES</h1>
    <h2>Relatório Detalhado de Cálculo de Pagamentos</h2>
  </div>
  <div class="info-section">
    <div class="info-row">
      <span><span class="info-label">Registro:</span> ${registro}</span>
      <span><span class="info-label">Nome:</span> ${nome || 'N/A'}</span>
    </div>
    <div class="info-row">
      <span><span class="info-label">Período:</span> ${formatDateDBToBR(inicio)} a ${formatDateDBToBR(fim)}</span>
      <span><span class="info-label">Data de Geração:</span> ${new Date().toLocaleString('pt-BR')}</span>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 10%;">Item</th>
        <th style="width: 40%;">Competência</th>
        <th style="width: 30%;">Valor Calculado</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="total-section">
    <div class="total-row">Total Calculado: ${formatBRL(total)}</div>
  </div>
  <div class="footer">
    <p class="footer-note">
      <strong>Observação:</strong> O valor total calculado refere-se à soma dos valores por competência no período informado.
      Eventuais divergências em relação ao valor mensal deverão ser verificadas junto ao departamento de Recursos Humanos.
      Os valores estão sujeitos a conferência mensal e ajustes na competência subsequente, caso necessário.
    </p>
    <p class="footer-note" style="margin-top: 8px;">
      <strong>Limite Mensal:</strong> O limite mensal para pagamento de horas extras é de R$ 1.500,00 (mil e quinhentos reais).
      Valores que ultrapassem este limite deverão ser encaminhados para aprovação da diretoria antes do processamento da folha.
    </p>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`

  printWindow.document.write(html)
  printWindow.document.close()
  return true
}
