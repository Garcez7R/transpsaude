export type RequestStatus =
  | 'recebida'
  | 'em_analise'
  | 'aguardando_documentos'
  | 'aprovada'
  | 'agendada'
  | 'cancelada'
  | 'concluida'

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

export interface StatusHistoryEntry {
  status: RequestStatus
  label: string
  updatedAt: string
  note?: string
}

export interface PublicRequestDetails extends TravelRequest {
  statusLabel: string
  protocolPinHint: string
  history: StatusHistoryEntry[]
}
