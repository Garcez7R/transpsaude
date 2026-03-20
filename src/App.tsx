import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminManagersPage } from './pages/AdminManagersPage'
import { InstallAppBar } from './components/InstallAppBar'
import { DashboardPage } from './pages/DashboardPage'
import { DriverPortalPage } from './pages/DriverPortalPage'
import { DriversPage } from './pages/DriversPage'
import { ManagerPage } from './pages/ManagerPage'
import { PublicStatusPage } from './pages/PublicStatusPage'
import { RequestDetailsPage } from './pages/RequestDetailsPage'
import { RegisterRequestPage } from './pages/RegisterRequestPage'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<PublicStatusPage />} />
        <Route path="/acompanhar" element={<Navigate to="/" replace />} />
        <Route path="/operador" element={<DashboardPage />} />
        <Route path="/operador/cadastro" element={<RegisterRequestPage />} />
        <Route path="/operador/solicitacoes/:id" element={<RequestDetailsPage />} />
        <Route path="/operador/motoristas" element={<Navigate to="/gerente/equipe" replace />} />
        <Route path="/admin" element={<AdminManagersPage />} />
        <Route path="/admin/gerentes" element={<Navigate to="/admin" replace />} />
        <Route path="/gerente" element={<ManagerPage />} />
        <Route path="/gerente/equipe" element={<DriversPage />} />
        <Route path="/gerente/motoristas" element={<Navigate to="/motorista" replace />} />
        <Route path="/motorista" element={<DriverPortalPage />} />
        <Route path="/motoristas" element={<Navigate to="/motorista" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <InstallAppBar />
    </>
  )
}
