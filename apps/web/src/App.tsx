import { Navigate, Route, Routes } from 'react-router'
import { useMe } from './api/hooks'
import { RequireAuth } from './components/RequireAuth'
import { CenteredSpinner } from './components/ui'
import { LoginPage } from './pages/LoginPage'
import { EmployeePage } from './pages/EmployeePage'
import { OwnerPage } from './pages/OwnerPage'
import { EmployeesPage } from './pages/EmployeesPage'
import { SettingsPage } from './pages/SettingsPage'

function HomeRedirect() {
  const me = useMe()
  if (me.isPending) return <CenteredSpinner />
  const user = me.data?.user
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'owner' ? '/admin' : '/app'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/app"
        element={
          <RequireAuth role="employee">
            <EmployeePage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth role="owner">
            <OwnerPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/employees"
        element={
          <RequireAuth role="owner">
            <EmployeesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
