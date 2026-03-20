export type RequestStatus =
  | 'recebida'
  | 'em_analise'
  | 'aguardando_documentos'
  | 'aprovada'
  | 'agendada'
  | 'cancelada'
  | 'concluida'

export interface RequestRecord {
  id: number
  protocol: string
  protocolPin: string
  patientName: string
  cpfMasked: string
  destinationCity: string
  destinationState: string
  treatmentUnit: string
  specialty: string
  travelDate: string
  requestedAt: string
  status: RequestStatus
  companionRequired: boolean
  notes?: string
}

export const mockRequests: RequestRecord[] = [
  {
    id: 1,
    protocol: 'TS-2026-000124',
    protocolPin: '4821',
    patientName: 'Maria das Dores Silva',
    cpfMasked: '***.248.***-31',
    destinationCity: 'Barretos',
    destinationState: 'SP',
    treatmentUnit: 'Hospital de Amor',
    specialty: 'Oncologia',
    travelDate: '24/03/2026',
    requestedAt: '18/03/2026',
    status: 'agendada',
    companionRequired: true,
    notes: 'Apresentar documento com foto no embarque.',
  },
  {
    id: 2,
    protocol: 'TS-2026-000125',
    protocolPin: '7710',
    patientName: 'Joao Pedro Almeida',
    cpfMasked: '***.937.***-08',
    destinationCity: 'Ribeirao Preto',
    destinationState: 'SP',
    treatmentUnit: 'HC Ribeirao',
    specialty: 'Nefrologia',
    travelDate: '26/03/2026',
    requestedAt: '19/03/2026',
    status: 'aguardando_documentos',
    companionRequired: false,
    notes: 'Falta laudo medico atualizado.',
  },
  {
    id: 3,
    protocol: 'TS-2026-000126',
    protocolPin: '3314',
    patientName: 'Ana Luiza Santos',
    cpfMasked: '***.111.***-54',
    destinationCity: 'Sao Paulo',
    destinationState: 'SP',
    treatmentUnit: 'Hospital das Clinicas',
    specialty: 'Neurologia',
    travelDate: '28/03/2026',
    requestedAt: '19/03/2026',
    status: 'em_analise',
    companionRequired: true,
  },
]

export const historyByProtocol: Record<string, Array<{ status: RequestStatus; label: string; updatedAt: string; note?: string }>> = {
  'TS-2026-000124': [
    { status: 'recebida', label: 'Recebida', updatedAt: '18/03/2026 09:12' },
    { status: 'aprovada', label: 'Aprovada', updatedAt: '18/03/2026 15:30' },
    {
      status: 'agendada',
      label: 'Agendada',
      updatedAt: '19/03/2026 10:05',
      note: 'Saida prevista as 04:30 no terminal municipal.',
    },
  ],
  'TS-2026-000125': [
    { status: 'recebida', label: 'Recebida', updatedAt: '19/03/2026 08:15' },
    {
      status: 'aguardando_documentos',
      label: 'Aguardando documentos',
      updatedAt: '19/03/2026 11:40',
      note: 'Necessario anexar laudo atualizado.',
    },
  ],
  'TS-2026-000126': [
    { status: 'recebida', label: 'Recebida', updatedAt: '19/03/2026 09:02' },
    { status: 'em_analise', label: 'Em analise', updatedAt: '19/03/2026 13:18' },
  ],
}

export const statusLabels: Record<RequestStatus, string> = {
  recebida: 'Recebida',
  em_analise: 'Em analise',
  aguardando_documentos: 'Aguardando documentos',
  aprovada: 'Aprovada',
  agendada: 'Agendada',
  cancelada: 'Cancelada',
  concluida: 'Concluida',
}
