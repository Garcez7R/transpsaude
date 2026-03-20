import { Navigate, Route, Routes } from 'react-router-dom'
import { InstallAppBar } from './components/InstallAppBar'
import { DashboardPage } from './pages/DashboardPage'
import { DriverPortalPage } from './pages/DriverPortalPage'
import { DriversPage } from './pages/DriversPage'
import { ManagerPage } from './pages/ManagerPage'
import { PublicStatusPage } from './pages/PublicStatusPage'
import { RegisterRequestPage } from './pages/RegisterRequestPage'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<PublicStatusPage />} />
        <Route path="/acompanhar" element={<Navigate to="/" replace />} />
        <Route path="/operador" element={<DashboardPage />} />
        <Route path="/operador/cadastro" element={<RegisterRequestPage />} />
        <Route path="/operador/motoristas" element={<DriversPage />} />
        <Route path="/gerente" element={<ManagerPage />} />
        <Route path="/motorista" element={<DriverPortalPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <InstallAppBar />
    </>
  )
}
