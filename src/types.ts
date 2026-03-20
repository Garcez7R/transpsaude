export type RequestStatus =
  | 'recebida'
  | 'em_analise'
  | 'aguardando_documentos'
  | 'aprovada'
  | 'agendada'
  | 'cancelada'
  | 'concluida'

export type InternalRole = 'operator' | 'manager' | 'admin'

export interface DashboardSummary {
  totalRequests: number
  scheduledToday: number
  pendingDocuments: number
  approvedRequests: number
}

export interface TravelRequest {
  id: number
  protocol: string
  patientName: string
  cpfMasked: string
  phone?: string
  addressLine?: string
  useCustomBoardingLocation?: boolean
  boardingLocationName?: string
  boardingLocationLabel?: string
  accessCpfMasked?: string
  destinationCity: string
  destinationState: string
  treatmentUnit: string
  specialty: string
  travelDate: string
  requestedAt: string
  status: RequestStatus
  companionRequired: boolean
  companionName?: string
  companionCpfMasked?: string
  companionPhone?: string
  companionIsWhatsapp?: boolean
  companionAddressLine?: string
  assignedDriverId?: number | null
  assignedDriverName?: string
  departureTime?: string
  managerNotes?: string
  scheduledAt?: string
  notes?: string
}

export interface StatusHistoryEntry {
  status: RequestStatus
  label: string
  updatedAt: string
  note?: string
}

export interface TravelRequestDetails extends TravelRequest {
  patientCpf: string
  phone: string
  isWhatsapp: boolean
  addressLine: string
  cns: string
  responsibleName?: string
  responsibleCpfMasked?: string
  useResponsibleCpfForAccess: boolean
}

export interface PublicRequestDetails extends TravelRequest {
  statusLabel: string
  loginHint: string
  history: StatusHistoryEntry[]
}

export interface CitizenAccessResponse {
  mustChangePin: boolean
  patientName: string
  cpfMasked: string
  temporaryPasswordLabel: string
  request: PublicRequestDetails | null
}

export interface AdminSession {
  operatorId: number
  name: string
  role: InternalRole
  cpf: string
}

export interface AdminLoginResponse {
  session: AdminSession
}

export interface DriverRecord {
  id: number
  name: string
  cpf: string
  cpfMasked: string
  phone: string
  isWhatsapp: boolean
  vehicleName: string
  active: boolean
}

export interface DriverSession {
  driverId: number
  name: string
  cpf: string
  vehicleName: string
}

export interface DriverLoginResponse {
  session: DriverSession
}

export interface CreateDriverInput {
  name: string
  cpf: string
  phone: string
  isWhatsapp: boolean
  vehicleName: string
  password: string
}

export interface AssignDriverInput {
  requestId: number
  driverId: number
  departureTime: string
  managerNotes: string
  useCustomBoardingLocation: boolean
  boardingLocationName: string
}

export interface UpdateRequestStatusInput {
  requestId: number
  status: RequestStatus
  note: string
}

export interface CreateTravelRequestInput {
  patientName: string
  cpf: string
  cns: string
  phone: string
  isWhatsapp: boolean
  addressLine: string
  accessCpf: string
  useResponsibleCpfForAccess: boolean
  responsibleName: string
  responsibleCpf: string
  companionName: string
  companionCpf: string
  companionPhone: string
  companionIsWhatsapp: boolean
  usePatientAddressForCompanion: boolean
  companionAddressLine: string
  destinationCity: string
  destinationState: string
  treatmentUnit: string
  specialty: string
  travelDate: string
  companionRequired: boolean
  notes: string
}

export interface CreateTravelRequestResponse {
  protocol: string
  temporaryPassword: string
  status: RequestStatus
  message: string
}
