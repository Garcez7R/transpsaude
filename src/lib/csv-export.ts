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
interface PatientExport {
  fullName: string
  cpfMasked: string
  accessCpfMasked: string
  phone: string
  cns: string
  addressLine: string
  responsibleName: string
  isWhatsapp: boolean
  useResponsibleCpfForAccess: boolean
}

interface RequestExport {
  protocol: string
  patientName: string
  cpfMasked: string
  destinationCity: string
  destinationState: string
  travelDate: string
  appointmentTime: string
  departureTime: string
  status: string
  assignedDriverName: string
  companionRequired: boolean
  treatmentUnit: string
  specialty: string
}

interface DriverExport {
  name: string
  cpfMasked: string
  phone: string
  vehicleName: string
  isWhatsapp: boolean
}

interface VehicleExport {
  name: string
  plate: string
  category: string
}

interface OperatorExport {
  name: string
  cpfMasked: string
  email: string
  role: string
}

export const exportConfigs = {
  patients: {
    filename: 'pacientes',
    columns: [
      { header: 'Nome', accessor: (p: PatientExport) => p.fullName },
      { header: 'CPF', accessor: (p: PatientExport) => p.cpfMasked },
      { header: 'CPF de Acesso', accessor: (p: PatientExport) => p.accessCpfMasked },
      { header: 'Telefone', accessor: (p: PatientExport) => p.phone },
      { header: 'CNS', accessor: (p: PatientExport) => p.cns },
      { header: 'Endereço', accessor: (p: PatientExport) => p.addressLine },
      { header: 'Responsável', accessor: (p: PatientExport) => p.responsibleName },
      { header: 'WhatsApp', accessor: (p: PatientExport) => (p.isWhatsapp ? 'Sim' : 'Não') },
      { header: 'Acesso por Responsável', accessor: (p: PatientExport) => (p.useResponsibleCpfForAccess ? 'Sim' : 'Não') },
    ] as CsvColumn<PatientExport>[],
  },

  requests: {
    filename: 'solicitacoes',
    columns: [
      { header: 'Protocolo', accessor: (r: RequestExport) => r.protocol },
      { header: 'Paciente', accessor: (r: RequestExport) => r.patientName },
      { header: 'CPF', accessor: (r: RequestExport) => r.cpfMasked },
      { header: 'Destino', accessor: (r: RequestExport) => `${r.destinationCity}/${r.destinationState}` },
      { header: 'Data da Viagem', accessor: (r: RequestExport) => r.travelDate },
      { header: 'Horário Consulta', accessor: (r: RequestExport) => r.appointmentTime || 'A definir' },
      { header: 'Horário Saída', accessor: (r: RequestExport) => r.departureTime || 'A definir' },
      { header: 'Status', accessor: (r: RequestExport) => r.status },
      { header: 'Motorista', accessor: (r: RequestExport) => r.assignedDriverName || 'Não atribuído' },
      { header: 'Acompanhante', accessor: (r: RequestExport) => (r.companionRequired ? 'Sim' : 'Não') },
      { header: 'Unidade', accessor: (r: RequestExport) => r.treatmentUnit },
      { header: 'Especialidade', accessor: (r: RequestExport) => r.specialty },
    ] as CsvColumn<RequestExport>[],
  },

  drivers: {
    filename: 'motoristas',
    columns: [
      { header: 'Nome', accessor: (d: DriverExport) => d.name },
      { header: 'CPF', accessor: (d: DriverExport) => d.cpfMasked },
      { header: 'Telefone', accessor: (d: DriverExport) => d.phone },
      { header: 'Veículo', accessor: (d: DriverExport) => d.vehicleName || 'Sem vínculo' },
      { header: 'WhatsApp', accessor: (d: DriverExport) => (d.isWhatsapp ? 'Sim' : 'Não') },
    ] as CsvColumn<DriverExport>[],
  },

  vehicles: {
    filename: 'veiculos',
    columns: [
      { header: 'Nome', accessor: (v: VehicleExport) => v.name },
      { header: 'Placa', accessor: (v: VehicleExport) => v.plate },
      { header: 'Categoria', accessor: (v: VehicleExport) => v.category },
    ] as CsvColumn<VehicleExport>[],
  },

  operators: {
    filename: 'operadores',
    columns: [
      { header: 'Nome', accessor: (o: OperatorExport) => o.name },
      { header: 'CPF', accessor: (o: OperatorExport) => o.cpfMasked },
      { header: 'E-mail', accessor: (o: OperatorExport) => o.email },
      { header: 'Perfil', accessor: (o: OperatorExport) => o.role },
    ] as CsvColumn<OperatorExport>[],
  },
}

/**
 * Exporta dados usando configuração pré-definida
 */
export function exportData(type: ExportDataType, data: unknown[]): void {
  const config = exportConfigs[type]
  if (!config) {
    console.error(`Configuração de exportação não encontrada para: ${type}`)
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exportToCsv(data as any[], config.columns as CsvColumn<any>[], config.filename)
}
