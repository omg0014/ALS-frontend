import { useEffect, useState } from 'react'
import { Code } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { formatDateTime } from '../../lib/format.js'
import { Alert, Badge, Button, Card, Modal } from '../../components/ui/index.js'
import { CodePreview } from '../../components/firmware/CodePreview.jsx'

// The code one build put on the board (passwords hidden).
function BuildCode({ build, onClose }) {
  const [code, setCode] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    api(`/builds/${build._id}/code`).then(setCode, (err) => setError(errorText(err)))
  }, [build._id])
  return (
    <Modal wide title={`Code from ${formatDateTime(build.createdAt)}`} description={`Firmware ${build.version} · WiFi "${build.wifiSsid}". Passwords are shown as <redacted>.`} onClose={onClose}>
      <div className="stack-sm">
        {error && <Alert tone="bad">{error}</Alert>}
        {code && !code.programShown && (
          <Alert tone="info">This was firmware {code.version}. The program itself has changed since then, so only its settings (config.h) are shown.</Alert>
        )}
        <CodePreview preview={code} />
      </div>
    </Modal>
  )
}

// Firmware prepared for this device, and whether it ended up on the board.
export function BuildHistory({ deviceId, refreshKey }) {
  const [builds, setBuilds] = useState([])
  const [viewing, setViewing] = useState(null)
  useEffect(() => {
    api(`/devices/${deviceId}/builds`).then(setBuilds).catch(() => {})
  }, [deviceId, refreshKey])
  if (!builds.length) return null
  return (
    <Card title="Firmware history" description="Firmware prepared for this device, and the code each one put on the board. Secrets are never stored.">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Prepared</th>
              <th>By</th>
              <th>Version</th>
              <th>WiFi</th>
              <th>On the device</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {builds.map((b) => (
              <tr key={b._id}>
                <td className="nowrap small">{formatDateTime(b.createdAt)}</td>
                <td className="small">{b.createdBy?.name}</td>
                <td>
                  {b.version} <span className="sub">{b.profileCode}</span>
                </td>
                <td className="small">{b.wifiSsid}</td>
                <td>
                  {b.installedAt ? (
                    <Badge tone="ok">Installed {formatDateTime(b.installedAt)}</Badge>
                  ) : b.ota?.status === 'failed' ? (
                    <Badge tone="bad" title={b.ota.error}>
                      WiFi update failed
                    </Badge>
                  ) : b.compile?.status === 'failed' ? (
                    <Badge tone="bad">Could not be prepared</Badge>
                  ) : (
                    <span className="muted small">not yet</span>
                  )}
                </td>
                <td className="nowrap">
                  <Button size="sm" variant="ghost" icon={Code} onClick={() => setViewing(b)}>
                    View code
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {viewing && <BuildCode build={viewing} onClose={() => setViewing(null)} />}
    </Card>
  )
}
