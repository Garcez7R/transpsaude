import { Download, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { useInstallPrompt } from '../lib/pwa'

export function InstallAppBar() {
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(false)

  if (!canInstall || isInstalled || dismissed) {
    return null
  }

  async function handleInstall() {
    const installed = await promptInstall()

    if (!installed) {
      return
    }

    setDismissed(true)
  }

  return (
    <div className="install-app-bar" role="complementary" aria-label="Instalar aplicativo">
      <div className="install-app-copy">
        <span className="install-app-icon">
          <Smartphone size={16} />
        </span>
        <div>
          <strong>Instalar app</strong>
          <p>Adicione o TranspSaude na tela inicial do celular.</p>
        </div>
      </div>
      <div className="install-app-actions">
        <button className="install-app-button" type="button" onClick={handleInstall}>
          <Download size={16} />
          Instalar
        </button>
        <button className="install-dismiss-button" type="button" onClick={() => setDismissed(true)}>
          Agora não
        </button>
      </div>
    </div>
  )
}
