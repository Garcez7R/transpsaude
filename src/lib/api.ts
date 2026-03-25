import type {
  AdminLoginResponse,
  AssignDriverInput,
  CitizenAccessResponse,
  ConfirmCitizenRequestResponse,
  CreateDriverInput,
  CreateCitizenRequestMessageInput,
  CreateManagerInput,
  CreateOperatorInput,
  CreateRequestMessageInput,
  CreateTravelRequestInput,
  CreateTravelRequestResponse,
  CreateVehicleInput,
  DashboardSummary,
  DriverLoginResponse,
  DriverRecord,
  ManagerRecord,
  OperatorRecord,
  PatientRecord,
  RequestQueryFilters,
  StatusHistoryEntry,
  TravelRequest,
  TravelRequestDetails,
  UpdateDriverInput,
  UpdateManagerInput,
  UpdateOperatorInput,
  UpdatePatientInput,
  UpdateRequestScheduleInput,
  UpdateRequestStatusInput,
  UpdateVehicleInput,
  VehicleRecord,
} from '../types'
import { getAdminSession } from './admin-session'
import { getDriverSession } from './driver-session'
import { getManagerSession } from './manager-session'
import { getOperatorSession } from './operator-session'

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Falha na requisicao: ${response.status}`

    try {
      const responseText = await response.text()

      if (responseText) {
        if (responseText.includes('Worker threw exception')) {
          const rayMatch = responseText.match(/Ray ID:\s*<\/span>\s*<strong[^>]*>([^<]+)</i)
          const rayId = rayMatch?.[1]?.trim()
          message = rayId
            ? `Falha interna do Cloudflare Worker. Ray ID: ${rayId}.`
            : 'Falha interna do Cloudflare Worker.'
          throw new Error(message)
        }

        try {
          const payload = JSON.parse(responseText) as { message?: string }

          if (payload?.message) {
            message = payload.message
          } else {
            message = responseText
          }
        } catch {
          message = responseText
        }
      }
    } catch {
      // Mantém a mensagem padrão quando a resposta não vier em JSON.
    }

    throw new Error(message)
  }

  return (await response.json()) as T
}

function withAdminHeaders(init?: RequestInit): RequestInit {
  const session = typeof window !== 'undefined' ? getAdminSession() : null
  const headers = new Headers(init?.headers)

  if (session) {
    headers.set('x-session-token', session.token)
  }

  return {
    ...init,
    headers,
  }
}

function withInternalHeaders(init?: RequestInit): RequestInit {
  const session = typeof window !== 'undefined' ? (getAdminSession() ?? getManagerSession()) : null
  const headers = new Headers(init?.headers)

  if (session) {
    headers.set('x-session-token', session.token)
  }

  return {
    ...init,
    headers,
  }
}

function withOperatorHeaders(init?: RequestInit): RequestInit {
  const session = typeof window !== 'undefined' ? getOperatorSession() : null
  const headers = new Headers(init?.headers)

  if (session) {
    headers.set('x-session-token', session.token)
  }

  return {
    ...init,
    headers,
  }
}

function withDriverHeaders(init?: RequestInit): RequestInit {
  const session = typeof window !== 'undefined' ? getDriverSession() : null
  const headers = new Headers(init?.headers)

  if (session) {
    headers.set('x-session-token', session.token)
  }

  return {
    ...init,
    headers,
  }
}

export async function fetchDashboardSummary(accessMode: 'internal' | 'operator' = 'internal') {
  const response = await fetch('/api/dashboard', accessMode === 'operator' ? withOperatorHeaders() : withInternalHeaders())
  return parseJson<DashboardSummary>(response)
}

export async function fetchRequests(filters: RequestQueryFilters = {}, accessMode: 'internal' | 'operator' = 'internal') {
  const search = new URLSearchParams()

  if (filters.status && filters.status !== 'todos') {
    search.set('status', filters.status)
  }

  if (filters.search?.trim()) {
    search.set('search', filters.search.trim())
  }

  if (filters.travelDate) {
    search.set('travelDate', filters.travelDate)
  }

  if (filters.dateFrom) {
    search.set('dateFrom', filters.dateFrom)
  }

  if (filters.dateTo) {
    search.set('dateTo', filters.dateTo)
  }

  if (filters.driverId && filters.driverId > 0) {
    search.set('driverId', String(filters.driverId))
  }

  if (filters.destination?.trim()) {
    search.set('destination', filters.destination.trim())
  }

  const suffix = search.toString() ? `?${search.toString()}` : ''
  const response = await fetch(`/api/requests${suffix}`, accessMode === 'operator' ? withOperatorHeaders() : withInternalHeaders())
  return parseJson<TravelRequest[]>(response)
}

export async function fetchRequestDetails(requestId: number, accessMode: 'internal' | 'operator' = 'internal') {
  const search = new URLSearchParams({ id: String(requestId) })
  const response = await fetch(
    `/api/admin/request-detail?${search.toString()}`,
    accessMode === 'operator' ? withOperatorHeaders() : withInternalHeaders(),
  )
  return parseJson<TravelRequestDetails & { history: StatusHistoryEntry[] }>(response)
}

export async function markRequestPatientMessagesSeen(requestId: number, accessMode: 'internal' | 'operator' = 'internal') {
  const response = await fetch(
    '/api/admin/request-patient-message-read',
    (accessMode === 'operator' ? withOperatorHeaders : withInternalHeaders)({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId }),
    }),
  )

  return parseJson<{ requestId: number; operatorLastPatientMessageSeenAt: string }>(response)
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

export async function confirmCitizenRequest(cpf: string, password: string, requestId: number) {
  const response = await fetch('/api/public/confirm-request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cpf, password, requestId }),
  })

  return parseJson<ConfirmCitizenRequestResponse>(response)
}

export async function markCitizenRequestViewed(cpf: string, password: string, requestId: number) {
  const response = await fetch('/api/public/request-view', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cpf, password, requestId }),
  })

  return parseJson<{ requestId: number; viewedAt: string; messageSeenAt: string }>(response)
}

export async function createCitizenRequestMessage(input: CreateCitizenRequestMessageInput) {
  const response = await fetch('/api/public/request-messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

  return parseJson<{ message: string }>(response)
}

export async function loginAdmin(cpf: string, password: string) {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cpf, password }),
  })

  return parseJson<AdminLoginResponse>(response)
}

export async function activateAdminPassword(cpf: string, newPassword: string) {
  const response = await fetch('/api/admin/activate-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cpf, newPassword }),
  })

  return parseJson<{ message: string }>(response)
}

export async function createTravelRequest(input: CreateTravelRequestInput, accessMode: 'internal' | 'operator' = 'internal') {
  const response = await fetch('/api/admin/requests', (accessMode === 'operator' ? withOperatorHeaders : withInternalHeaders)({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<CreateTravelRequestResponse>(response)
}

export async function fetchDrivers() {
  const response = await fetch('/api/admin/drivers', withInternalHeaders())
  return parseJson<DriverRecord[]>(response)
}

export async function fetchVehicles() {
  const response = await fetch('/api/admin/vehicles', withInternalHeaders())
  return parseJson<VehicleRecord[]>(response)
}

export async function createDriver(input: CreateDriverInput) {
  const response = await fetch('/api/admin/drivers', withInternalHeaders({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<DriverRecord>(response)
}

export async function createVehicle(input: CreateVehicleInput) {
  const response = await fetch('/api/admin/vehicles', withAdminHeaders({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<VehicleRecord>(response)
}

export async function createManager(input: CreateManagerInput) {
  const response = await fetch('/api/admin/managers', withAdminHeaders({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function fetchManagers() {
  const response = await fetch('/api/admin/managers', withAdminHeaders())
  return parseJson<ManagerRecord[]>(response)
}

export async function updateManager(input: UpdateManagerInput) {
  const response = await fetch('/api/admin/managers', withAdminHeaders({
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function deleteManager(id: number) {
  const response = await fetch(`/api/admin/managers?id=${id}`, withAdminHeaders({
    method: 'DELETE',
  }))

  return parseJson<{ message: string }>(response)
}

export async function createOperator(input: CreateOperatorInput) {
  const response = await fetch('/api/admin/operators', withInternalHeaders({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function resetAccess(
  targetType: 'operator' | 'manager' | 'driver' | 'patient',
  id: number,
  accessMode: 'internal' | 'operator' = 'internal',
) {
  const response = await fetch('/api/admin/access-reset', (accessMode === 'operator' ? withOperatorHeaders : withInternalHeaders)({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetType, id }),
  }))

  return parseJson<{ message: string }>(response)
}

export async function fetchOperators() {
  const response = await fetch('/api/admin/operators', withInternalHeaders())
  return parseJson<OperatorRecord[]>(response)
}

export async function updateOperator(input: UpdateOperatorInput) {
  const response = await fetch('/api/admin/operators', withInternalHeaders({
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function deleteOperator(id: number) {
  const response = await fetch(`/api/admin/operators?id=${id}`, withInternalHeaders({
    method: 'DELETE',
  }))

  return parseJson<{ message: string }>(response)
}

export async function assignDriver(input: AssignDriverInput) {
  const response = await fetch('/api/admin/assignments', withInternalHeaders({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function updateRequestStatus(input: UpdateRequestStatusInput, accessMode: 'internal' | 'operator' = 'internal') {
  const response = await fetch('/api/admin/request-status', (accessMode === 'operator' ? withOperatorHeaders : withInternalHeaders)({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function updateRequestSchedule(input: UpdateRequestScheduleInput, accessMode: 'internal' | 'operator' = 'internal') {
  const response = await fetch('/api/admin/request-schedule', (accessMode === 'operator' ? withOperatorHeaders : withInternalHeaders)({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function createRequestMessage(
  input: CreateRequestMessageInput,
  accessMode: 'internal' | 'operator' = 'internal',
) {
  const response = await fetch('/api/admin/request-messages', (accessMode === 'operator' ? withOperatorHeaders : withInternalHeaders)({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function updateDriverPhoneVisibility(
  requestId: number,
  showDriverPhoneToPatient: boolean,
  accessMode: 'internal' | 'operator' = 'internal',
) {
  const response = await fetch('/api/admin/request-driver-visibility', (accessMode === 'operator' ? withOperatorHeaders : withInternalHeaders)({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestId, showDriverPhoneToPatient }),
  }))

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

export async function activateDriverPassword(cpf: string, newPassword: string) {
  const response = await fetch('/api/driver/activate-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cpf, newPassword }),
  })

  return parseJson<{ message: string }>(response)
}

export async function logoutSession(token: string) {
  const response = await fetch('/api/logout', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-session-token': token,
    },
  })

  return parseJson<{ message: string }>(response)
}

export async function fetchDriverTrips(driverId: number, accessMode: 'driver' | 'internal' = 'driver') {
  const search = new URLSearchParams({ driverId: String(driverId) })
  const init = accessMode === 'internal' ? withInternalHeaders() : withDriverHeaders()
  const response = await fetch(`/api/driver/trips?${search.toString()}`, init)
  return parseJson<TravelRequest[]>(response)
}

export async function createDriverRequestMessage(input: {
  requestId: number
  messageType?: string
  title?: string
  body: string
  visibleToCitizen?: boolean
}) {
  const response = await fetch('/api/driver/request-messages', withDriverHeaders({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function updateDriver(input: UpdateDriverInput) {
  const response = await fetch('/api/admin/drivers', withInternalHeaders({
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function deleteDriver(id: number) {
  const response = await fetch(`/api/admin/drivers?id=${id}`, withInternalHeaders({
    method: 'DELETE',
  }))

  return parseJson<{ message: string }>(response)
}

export async function updateVehicle(input: UpdateVehicleInput) {
  const response = await fetch('/api/admin/vehicles', withInternalHeaders({
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function deleteVehicle(id: number) {
  const response = await fetch(`/api/admin/vehicles?id=${id}`, withInternalHeaders({
    method: 'DELETE',
  }))

  return parseJson<{ message: string }>(response)
}

export async function fetchPatients(accessMode: 'internal' | 'operator' = 'internal') {
  const response = await fetch('/api/admin/patients', accessMode === 'operator' ? withOperatorHeaders() : withInternalHeaders())
  return parseJson<PatientRecord[]>(response)
}

export async function updatePatient(input: UpdatePatientInput) {
  const response = await fetch('/api/admin/patients', withInternalHeaders({
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function deletePatient(id: number) {
  const response = await fetch(`/api/admin/patients?id=${id}`, withInternalHeaders({
    method: 'DELETE',
  }))

  return parseJson<{ message: string }>(response)
}
