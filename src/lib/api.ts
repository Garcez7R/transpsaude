import type {
  AdminLoginResponse,
  AssignDriverInput,
  CitizenAccessResponse,
  CreateDriverInput,
  CreateTravelRequestInput,
  CreateTravelRequestResponse,
  DashboardSummary,
  DriverLoginResponse,
  DriverRecord,
  StatusHistoryEntry,
  TravelRequest,
  TravelRequestDetails,
  UpdateRequestScheduleInput,
  UpdateRequestStatusInput,
} from '../types'

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Falha na requisicao: ${response.status}`)
  }

  return (await response.json()) as T
}

export async function fetchDashboardSummary() {
  const response = await fetch('/api/dashboard')
  return parseJson<DashboardSummary>(response)
}

export async function fetchRequests(status?: string) {
  const search = new URLSearchParams()

  if (status && status !== 'todos') {
    search.set('status', status)
  }

  const suffix = search.toString() ? `?${search.toString()}` : ''
  const response = await fetch(`/api/requests${suffix}`)
  return parseJson<TravelRequest[]>(response)
}

export async function fetchRequestDetails(requestId: number) {
  const search = new URLSearchParams({ id: String(requestId) })
  const response = await fetch(`/api/admin/request-detail?${search.toString()}`)
  return parseJson<TravelRequestDetails & { history: StatusHistoryEntry[] }>(response)
}

export async function loginCitizen(cpf: string, password: string) {
  const response = await fetch('/api/public/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cpf, password }),
  })

  return parseJson<CitizenAccessResponse>(response)
}

export async function activateCitizenPin(cpf: string, newPin: string) {
  const response = await fetch('/api/public/activate-pin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cpf, newPin }),
  })

  return parseJson<CitizenAccessResponse>(response)
}

export async function loginAdmin(cpf: string, password: string) {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cpf, password }),
  })

  return parseJson<AdminLoginResponse>(response)
}

export async function createTravelRequest(input: CreateTravelRequestInput) {
  const response = await fetch('/api/admin/requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

  return parseJson<CreateTravelRequestResponse>(response)
}

export async function fetchDrivers() {
  const response = await fetch('/api/admin/drivers')
  return parseJson<DriverRecord[]>(response)
}

export async function createDriver(input: CreateDriverInput) {
  const response = await fetch('/api/admin/drivers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

  return parseJson<DriverRecord>(response)
}

export async function assignDriver(input: AssignDriverInput) {
  const response = await fetch('/api/admin/assignments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

  return parseJson<{ message: string }>(response)
}

export async function updateRequestStatus(input: UpdateRequestStatusInput) {
  const response = await fetch('/api/admin/request-status', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

  return parseJson<{ message: string }>(response)
}

export async function updateRequestSchedule(input: UpdateRequestScheduleInput) {
  const response = await fetch('/api/admin/request-schedule', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

  return parseJson<{ message: string }>(response)
}

export async function loginDriver(cpf: string, password: string) {
  const response = await fetch('/api/driver/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cpf, password }),
  })

  return parseJson<DriverLoginResponse>(response)
}

export async function fetchDriverTrips(driverId: number) {
  const search = new URLSearchParams({ driverId: String(driverId) })
  const response = await fetch(`/api/driver/trips?${search.toString()}`)
  return parseJson<TravelRequest[]>(response)
}
