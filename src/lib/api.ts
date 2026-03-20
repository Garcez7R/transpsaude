import type {
  AdminLoginResponse,
  AssignDriverInput,
  CitizenAccessResponse,
  CreateDriverInput,
  CreateManagerInput,
  CreateOperatorInput,
  CreateTravelRequestInput,
  CreateTravelRequestResponse,
  CreateVehicleInput,
  DashboardSummary,
  DriverLoginResponse,
  DriverRecord,
  OperatorRecord,
  PatientRecord,
  StatusHistoryEntry,
  TravelRequest,
  TravelRequestDetails,
  UpdateDriverInput,
  UpdateOperatorInput,
  UpdatePatientInput,
  UpdateRequestScheduleInput,
  UpdateRequestStatusInput,
  UpdateVehicleInput,
  VehicleRecord,
} from '../types'
import { getAdminSession } from './admin-session'
import { getDriverSession } from './driver-session'

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Falha na requisicao: ${response.status}`)
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

export async function fetchDashboardSummary() {
  const response = await fetch('/api/dashboard', withAdminHeaders())
  return parseJson<DashboardSummary>(response)
}

export async function fetchRequests(status?: string) {
  const search = new URLSearchParams()

  if (status && status !== 'todos') {
    search.set('status', status)
  }

  const suffix = search.toString() ? `?${search.toString()}` : ''
  const response = await fetch(`/api/requests${suffix}`, withAdminHeaders())
  return parseJson<TravelRequest[]>(response)
}

export async function fetchRequestDetails(requestId: number) {
  const search = new URLSearchParams({ id: String(requestId) })
  const response = await fetch(`/api/admin/request-detail?${search.toString()}`, withAdminHeaders())
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
  const response = await fetch('/api/admin/requests', withAdminHeaders({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<CreateTravelRequestResponse>(response)
}

export async function fetchDrivers() {
  const response = await fetch('/api/admin/drivers', withAdminHeaders())
  return parseJson<DriverRecord[]>(response)
}

export async function fetchVehicles() {
  const response = await fetch('/api/admin/vehicles', withAdminHeaders())
  return parseJson<VehicleRecord[]>(response)
}

export async function createDriver(input: CreateDriverInput) {
  const response = await fetch('/api/admin/drivers', withAdminHeaders({
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

export async function createOperator(input: CreateOperatorInput) {
  const response = await fetch('/api/admin/operators', withAdminHeaders({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function fetchOperators() {
  const response = await fetch('/api/admin/operators', withAdminHeaders())
  return parseJson<OperatorRecord[]>(response)
}

export async function updateOperator(input: UpdateOperatorInput) {
  const response = await fetch('/api/admin/operators', withAdminHeaders({
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function deleteOperator(id: number) {
  const response = await fetch(`/api/admin/operators?id=${id}`, withAdminHeaders({
    method: 'DELETE',
  }))

  return parseJson<{ message: string }>(response)
}

export async function assignDriver(input: AssignDriverInput) {
  const response = await fetch('/api/admin/assignments', withAdminHeaders({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function updateRequestStatus(input: UpdateRequestStatusInput) {
  const response = await fetch('/api/admin/request-status', withAdminHeaders({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function updateRequestSchedule(input: UpdateRequestScheduleInput) {
  const response = await fetch('/api/admin/request-schedule', withAdminHeaders({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
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

export async function fetchDriverTrips(driverId: number) {
  const search = new URLSearchParams({ driverId: String(driverId) })
  const response = await fetch(`/api/driver/trips?${search.toString()}`, withDriverHeaders(withAdminHeaders()))
  return parseJson<TravelRequest[]>(response)
}

export async function updateDriver(input: UpdateDriverInput) {
  const response = await fetch('/api/admin/drivers', withAdminHeaders({
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function deleteDriver(id: number) {
  const response = await fetch(`/api/admin/drivers?id=${id}`, withAdminHeaders({
    method: 'DELETE',
  }))

  return parseJson<{ message: string }>(response)
}

export async function updateVehicle(input: UpdateVehicleInput) {
  const response = await fetch('/api/admin/vehicles', withAdminHeaders({
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function deleteVehicle(id: number) {
  const response = await fetch(`/api/admin/vehicles?id=${id}`, withAdminHeaders({
    method: 'DELETE',
  }))

  return parseJson<{ message: string }>(response)
}

export async function fetchPatients() {
  const response = await fetch('/api/admin/patients', withAdminHeaders())
  return parseJson<PatientRecord[]>(response)
}

export async function updatePatient(input: UpdatePatientInput) {
  const response = await fetch('/api/admin/patients', withAdminHeaders({
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))

  return parseJson<{ message: string }>(response)
}

export async function deletePatient(id: number) {
  const response = await fetch(`/api/admin/patients?id=${id}`, withAdminHeaders({
    method: 'DELETE',
  }))

  return parseJson<{ message: string }>(response)
}
