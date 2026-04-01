/**
 * Utilitários para exportação de dados em formato CSV
 */

export interface CsvColumn<T> {
  header: string
  accessor: (item: T) => string | number | boolean | null | undefined
}

/**
 * Converte um valor para string CSV segura
 */
function escapeCsvValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue = String(value)

  // Se contém vírgula, aspas ou quebra de linha, envolve em aspas duplas
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

/**
 * Converte um array de dados para CSV
 */
export function exportToCsv<T>(
  data: T[],
  columns: CsvColumn<T>[],
  filename: string,
): void {
  // Cabeçalhos
  const headers = columns.map((col) => escapeCsvValue(col.header))
  const csvRows = [headers.join(';')]

  // Dados
  data.forEach((item) => {
    const row = columns.map((col) => escapeCsvValue(col.accessor(item)))
    csvRows.push(row.join(';'))
  })

  // Adiciona BOM para UTF-8 (excel compatibility)
  const bom = '\uFEFF'
  const csvContent = bom + csvRows.join('\n')

  // Cria blob e faz download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Tipos comuns de exportação
 */
export type ExportDataType = 'patients' | 'requests' | 'drivers' | 'vehicles' | 'operators'

/**
 * Configurações de colunas para cada tipo de exportação
 */
export const exportConfigs = {
  patients: {
    filename: 'pacientes',
    columns: [
      { header: 'Nome', accessor: (p: { fullName: string }) => p.fullName },
      { header: 'CPF', accessor: (p: { cpfMasked: string }) => p.cpfMasked },
      { header: 'CPF de Acesso', accessor: (p: { accessCpfMasked: string }) => p.accessCpfMasked },
      { header: 'Telefone', accessor: (p: { phone: string }) => p.phone },
      { header: 'CNS', accessor: (p: { cns: string }) => p.cns },
      { header: 'Endereço', accessor: (p: { addressLine: string }) => p.addressLine },
      { header: 'Responsável', accessor: (p: { responsibleName: string }) => p.responsibleName },
      { header: 'WhatsApp', accessor: (p: { isWhatsapp: boolean }) => (p.isWhatsapp ? 'Sim' : 'Não') },
      { header: 'Acesso por Responsável', accessor: (p: { useResponsibleCpfForAccess: boolean }) => (p.useResponsibleCpfForAccess ? 'Sim' : 'Não') },
    ] as CsvColumn<any>[],
  },

  requests: {
    filename: 'solicitacoes',
    columns: [
      { header: 'Protocolo', accessor: (r: { protocol: string }) => r.protocol },
      { header: 'Paciente', accessor: (r: { patientName: string }) => r.patientName },
      { header: 'CPF', accessor: (r: { cpfMasked: string }) => r.cpfMasked },
      { header: 'Destino', accessor: (r: { destinationCity: string; destinationState: string }) => `${r.destinationCity}/${r.destinationState}` },
      { header: 'Data da Viagem', accessor: (r: { travelDate: string }) => r.travelDate },
      { header: 'Horário Consulta', accessor: (r: { appointmentTime: string }) => r.appointmentTime || 'A definir' },
      { header: 'Horário Saída', accessor: (r: { departureTime: string }) => r.departureTime || 'A definir' },
      { header: 'Status', accessor: (r: { status: string }) => r.status },
      { header: 'Motorista', accessor: (r: { assignedDriverName: string }) => r.assignedDriverName || 'Não atribuído' },
      { header: 'Acompanhante', accessor: (r: { companionRequired: boolean }) => (r.companionRequired ? 'Sim' : 'Não') },
      { header: 'Unidade', accessor: (r: { treatmentUnit: string }) => r.treatmentUnit },
      { header: 'Especialidade', accessor: (r: { specialty: string }) => r.specialty },
    ] as CsvColumn<any>[],
  },

  drivers: {
    filename: 'motoristas',
    columns: [
      { header: 'Nome', accessor: (d: { name: string }) => d.name },
      { header: 'CPF', accessor: (d: { cpfMasked: string }) => d.cpfMasked },
      { header: 'Telefone', accessor: (d: { phone: string }) => d.phone },
      { header: 'Veículo', accessor: (d: { vehicleName: string }) => d.vehicleName || 'Sem vínculo' },
      { header: 'WhatsApp', accessor: (d: { isWhatsapp: boolean }) => (d.isWhatsapp ? 'Sim' : 'Não') },
    ] as CsvColumn<any>[],
  },

  vehicles: {
    filename: 'veiculos',
    columns: [
      { header: 'Nome', accessor: (v: { name: string }) => v.name },
      { header: 'Placa', accessor: (v: { plate: string }) => v.plate },
      { header: 'Categoria', accessor: (v: { category: string }) => v.category },
    ] as CsvColumn<any>[],
  },

  operators: {
    filename: 'operadores',
    columns: [
      { header: 'Nome', accessor: (o: { name: string }) => o.name },
      { header: 'CPF', accessor: (o: { cpfMasked: string }) => o.cpfMasked },
      { header: 'E-mail', accessor: (o: { email: string }) => o.email },
      { header: 'Perfil', accessor: (o: { role: string }) => o.role },
    ] as CsvColumn<any>[],
  },
}

/**
 * Exporta dados usando configuração pré-definida
 */
export function exportData(type: ExportDataType, data: any[]): void {
  const config = exportConfigs[type]
  if (!config) {
    console.error(`Configuração de exportação não encontrada para: ${type}`)
    return
  }

  exportToCsv(data, config.columns, config.filename)
}