import type {
  AdminLoginResponse,
  CitizenAccessResponse,
  CreateTravelRequestInput,
  CreateTravelRequestResponse,
  DashboardSummary,
  PublicRequestDetails,
  TravelRequest,
} from '../types'

const mockRequests: TravelRequest[] = [
  {
    id: 1,
    protocol: 'TS-2026-000124',
    patientName: 'Maria das Dores Silva',
    cpfMasked: '248.903.120-31',
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
    cpfMasked: '937.554.880-08',
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
    cpfMasked: '111.222.333-54',
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
  loginHint: 'Saida prevista as 04:30 no terminal municipal.',
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

const mockCitizenAccess: CitizenAccessResponse = {
  mustChangePin: true,
  patientName: mockPublicRequest.patientName,
  cpfMasked: mockPublicRequest.cpfMasked,
  temporaryPasswordLabel: '0000',
  request: mockPublicRequest,
}

const mockAdminLogin: AdminLoginResponse = {
  session: {
    operatorId: 1,
    name: 'Administrador Geral',
    role: 'admin',
    cpf: '968.203.730-15',
  },
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Falha na requisicao: ${response.status}`)
  }

  return (await response.json()) as T
}

function normalizeCpf(value: string) {
  return value.replace(/\D/g, '')
}

function formatCpf(value: string) {
  const digits = normalizeCpf(value)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
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

export async function loginCitizen(cpf: string, password: string) {
  try {
    const response = await fetch('/api/public/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cpf, password }),
    })

    return await parseJson<CitizenAccessResponse>(response)
  } catch {
    if (normalizeCpf(cpf) === '24890312031' && (password === '0000' || password === '4821')) {
      return {
        ...mockCitizenAccess,
        mustChangePin: password === '0000',
      }
    }

    throw new Error('Acesso nao encontrado')
  }
}

export async function activateCitizenPin(cpf: string, newPin: string) {
  try {
    const response = await fetch('/api/public/activate-pin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cpf, newPin }),
    })

    return await parseJson<CitizenAccessResponse>(response)
  } catch {
    if (normalizeCpf(cpf) === '24890312031' && /^\d{4}$/.test(newPin)) {
      return {
        ...mockCitizenAccess,
        mustChangePin: false,
      }
    }

    throw new Error('Nao foi possivel ativar o PIN')
  }
}

export async function loginAdmin(cpf: string, password: string) {
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cpf, password }),
    })

    return await parseJson<AdminLoginResponse>(response)
  } catch {
    if (normalizeCpf(cpf) === '96820373015' && password === '1978') {
      return mockAdminLogin
    }

    throw new Error('Acesso admin nao encontrado')
  }
}

export async function createTravelRequest(input: CreateTravelRequestInput) {
  try {
    const response = await fetch('/api/admin/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })

    return await parseJson<CreateTravelRequestResponse>(response)
  } catch {
    const protocol = `TS-2026-${String(mockRequests.length + 124).padStart(6, '0')}`

    return {
      protocol,
      temporaryPassword: '0000',
      status: 'recebida',
      message: `Solicitacao simulada para ${input.patientName}. No primeiro acesso, o acesso fica no CPF ${formatCpf(input.accessCpf)} com senha 0000.`,
    }
  }
}
