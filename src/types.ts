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
  appointmentTime?: string
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
  assignedDriverPhone?: string
  showDriverPhoneToPatient?: boolean
  assignedVehicleId?: number | null
  assignedVehicleName?: string
  patientConfirmedAt?: string | null
  patientLastViewedAt?: string | null
  patientLastMessageSeenAt?: string | null
  operatorLastPatientMessageSeenAt?: string | null
  hasUnreadPatientMessage?: boolean
  patientMessageCount?: number
  messages?: RequestMessage[]
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

export interface RequestMessage {
  id: number
  messageType: string
  title?: string
  body: string
  visibleToCitizen: boolean
  createdByName: string
  createdByRole?: string
  createdAt: string
}

export interface TravelRequestDetails extends TravelRequest {
  patientId: number
  patientCpf: string
  phone: string
  isWhatsapp: boolean
  addressLine: string
  cns: string
  responsibleName?: string
  responsibleCpfMasked?: string
  useResponsibleCpfForAccess: boolean
  messages: RequestMessage[]
}

export interface PublicRequestDetails extends TravelRequest {
  statusLabel: string
  loginHint: string
  history: StatusHistoryEntry[]
  messages: RequestMessage[]
}

export interface CitizenAccessResponse {
  mustChangePin: boolean
  patientName: string
  cpfMasked: string
  temporaryPasswordLabel: string
  request: PublicRequestDetails | null
  requests: PublicRequestDetails[]
}

export interface ConfirmCitizenRequestResponse extends CitizenAccessResponse {
  message: string
  confirmedAt: string
}

export interface AdminSession {
  token: string
  operatorId: number
  name: string
  role: InternalRole
  cpf: string
  expiresAt: string
}

export interface FirstAccessChallenge {
  mustChangePassword: boolean
  temporaryPasswordLabel: string
  name: string
  cpf: string
}

export interface AdminLoginResponse {
  mustChangePassword: boolean
  temporaryPasswordLabel: string
  name: string
  cpf: string
  role?: InternalRole
  session?: AdminSession
}

export interface DriverRecord {
  id: number
  name: string
  cpf: string
  cpfMasked: string
  phone: string
  isWhatsapp: boolean
  vehicleId?: number | null
  vehicleName: string
  active: boolean
}

export interface OperatorRecord {
  id: number
  name: string
  cpf: string
  cpfMasked: string
  email: string
  role: Extract<InternalRole, 'operator'>
  active: boolean
}

export interface ManagerRecord {
  id: number
  name: string
  cpf: string
  cpfMasked: string
  email: string
  role: Extract<InternalRole, 'manager'>
  active: boolean
}

export interface PatientRecord {
  id: number
  fullName: string
  cpf: string
  cpfMasked: string
  accessCpf: string
  accessCpfMasked: string
  phone: string
  isWhatsapp: boolean
  addressLine: string
  cns?: string
  responsibleName?: string
  responsibleCpf?: string
  responsibleCpfMasked?: string
  useResponsibleCpfForAccess: boolean
  active: boolean
}

export interface DriverSession {
  token: string
  driverId: number
  name: string
  cpf: string
  vehicleName: string
  expiresAt: string
}

export interface RequestQueryFilters {
  status?: RequestStatus | 'todos'
  search?: string
  travelDate?: string
  dateFrom?: string
  dateTo?: string
  driverId?: number | null
  destination?: string
}

export interface DriverLoginResponse {
  mustChangePassword: boolean
  temporaryPasswordLabel: string
  name: string
  cpf: string
  session?: DriverSession
}

export interface CreateDriverInput {
  name: string
  cpf: string
  phone: string
  isWhatsapp: boolean
  vehicleId: number | null
}

export interface VehicleRecord {
  id: number
  name: string
  plate: string
  category: string
  active: boolean
}

export interface CreateVehicleInput {
  name: string
  plate: string
  category: string
}

export interface CreateManagerInput {
  name: string
  cpf: string
  email: string
}

export interface CreateOperatorInput {
  name: string
  cpf: string
  email: string
}

export interface UpdateOperatorInput {
  id: number
  name: string
  cpf: string
  email: string
  password?: string
}

export interface UpdateManagerInput {
  id: number
  name: string
  cpf: string
  email: string
  password?: string
}

export interface UpdateDriverInput {
  id: number
  name: string
  cpf: string
  phone: string
  isWhatsapp: boolean
  vehicleId: number | null
  password?: string
}

export interface UpdateVehicleInput {
  id: number
  name: string
  plate: string
  category: string
}

export interface UpdatePatientInput {
  id: number
  fullName: string
  cpf: string
  accessCpf: string
  phone: string
  isWhatsapp: boolean
  addressLine: string
  cns: string
  responsibleName: string
  responsibleCpf: string
  useResponsibleCpfForAccess: boolean
}

export interface AssignDriverInput {
  requestId: number
  driverId: number
  vehicleId?: number
  departureTime?: string
  appointmentTime?: string
  managerNotes: string
  useCustomBoardingLocation: boolean
  boardingLocationName: string
  showDriverPhoneToPatient: boolean
}

export interface UpdateRequestStatusInput {
  requestId: number
  status: RequestStatus
  note: string
}

export interface UpdateRequestScheduleInput {
  requestId: number
  travelDate: string
  departureTime: string
  appointmentTime: string
  note: string
}

export interface CreateRequestMessageInput {
  requestId: number
  messageType: string
  title: string
  body: string
  visibleToCitizen: boolean
}

export interface CreateCitizenRequestMessageInput {
  cpf: string
  password: string
  requestId: number
  title: string
  body: string
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
  appointmentTime: string
  companionRequired: boolean
  notes: string
}

export interface CreateTravelRequestResponse {
  protocol: string
  temporaryPassword: string
  status: RequestStatus
  message: string
}
