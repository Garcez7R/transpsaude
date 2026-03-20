import type { DashboardSummary, PublicRequestDetails, TravelRequest } from '../types'

const mockRequests: TravelRequest[] = [
  {
    id: 1,
    protocol: 'TS-2026-000124',
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
    notes: 'Saida prevista as 04:30 no terminal municipal.',
  },
  {
    id: 2,
    protocol: 'TS-2026-000125',
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

const mockSummary: DashboardSummary = {
  totalRequests: 3,
  scheduledToday: 1,
  pendingDocuments: 1,
  approvedRequests: 1,
}

const mockPublicRequest: PublicRequestDetails = {
  ...mockRequests[0],
  statusLabel: 'Agendada',
  protocolPinHint: 'Saida prevista as 04:30 no terminal municipal.',
  history: [
    { status: 'recebida', label: 'Recebida', updatedAt: '18/03/2026 09:12' },
    { status: 'aprovada', label: 'Aprovada', updatedAt: '18/03/2026 15:30' },
    {
      status: 'agendada',
      label: 'Agendada',
      updatedAt: '19/03/2026 10:05',
      note: 'Comparecer 30 minutos antes do embarque.',
    },
  ],
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Falha na requisicao: ${response.status}`)
  }

  return (await response.json()) as T
}

export async function fetchDashboardSummary() {
  try {
    const response = await fetch('/api/dashboard')
    return await parseJson<DashboardSummary>(response)
  } catch {
    return mockSummary
  }
}

export async function fetchRequests(status?: string) {
  const search = new URLSearchParams()

  if (status && status !== 'todos') {
    search.set('status', status)
  }

  const suffix = search.toString() ? `?${search.toString()}` : ''
  try {
    const response = await fetch(`/api/requests${suffix}`)
    return await parseJson<TravelRequest[]>(response)
  } catch {
    return mockRequests.filter((item) => (status && status !== 'todos' ? item.status === status : true))
  }
}

export async function fetchPublicRequest(protocol: string, pin: string) {
  try {
    const search = new URLSearchParams({ protocol, pin })
    const response = await fetch(`/api/public/status?${search.toString()}`)
    return await parseJson<PublicRequestDetails>(response)
  } catch {
    if (protocol === mockPublicRequest.protocol && pin === '4821') {
      return mockPublicRequest
    }

    throw new Error('Solicitacao nao encontrada')
  }
}
