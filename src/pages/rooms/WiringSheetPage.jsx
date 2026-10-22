import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { api, errorText } from '../../api/client.js'
import { useLive } from '../../context/LiveContext.js'
import { Alert, Button, Card, Loading, PageHeader } from '../../components/ui/index.js'
import { WiringDiagram } from '../../components/wiring/WiringDiagram.jsx'
import { WiringTables } from '../../components/wiring/WiringTables.jsx'

// Printable wiring sheet for the electrician: one page per relay box in the room.
export default function WiringSheetPage() {
  const { id } = useParams()
  const { index } = useLive()
  const [sheets, setSheets] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    ;(async () => {
      const st = await api(`/rooms/${id}/install`)
      const plans = await Promise.all(st.devices.map((d) => api(`/devices/${d._id}/wiring`)))
      setSheets({ room: st.room, groups: st.groups, plans })
    })().catch((e) => setError(errorText(e)))
  }, [id])

  if (error) return <Alert tone="bad">{error}</Alert>
  if (!sheets || !index) return <Loading />
  const groupName = (gid) => sheets.groups.find((g) => g._id === gid)?.name

  return (
    <>
      <div className="no-print">
        <PageHeader
          back={{ to: `/rooms/${id}/install`, label: 'Installation steps' }}
          title={`Wiring sheet: ${sheets.room.displayName}`}
          description="Print this for the electrician. It shows every wire of each relay box in this room."
          actions={
            <Button variant="primary" icon={Printer} onClick={() => window.print()}>
              Print
            </Button>
          }
        />
      </div>
      {!sheets.plans.length && <Alert tone="warn">There is no device in this room yet.</Alert>}
      <div className="stack-lg">
        {sheets.plans.map(({ device, plan, checklist }) => (
          <Card key={device._id} className="stack print-page">
            <div>
              <h2>
                {sheets.room.displayName} · {device.name}
              </h2>
              <div className="small muted">
                {sheets.room.floor?.name} · <code>{device.deviceId}</code> · {device.profile.code}: {device.profile.espBoard} + {device.profile.relayModule} · printed{' '}
                {new Date().toLocaleDateString()}
              </div>
            </div>
            {!device.profile.verified && <Alert tone="warn">This hardware type is not tested yet: use it on the desk only, do not install it.</Alert>}
            <Alert tone="bad" title="Electrician only">
              All 230 V work is done by an electrician. This sheet is a reference, not instructions for unqualified people.
            </Alert>
            <WiringDiagram profile={device.profile} channels={index.devices.get(device._id)?.channels ?? []} groupName={groupName} />
            <WiringTables plan={plan} />
            <div>
              <h3 style={{ marginBottom: 6 }}>Checklist</h3>
              <ul className="plain-list small">
                {checklist.map((c) => (
                  <li key={c}>☐ {c}</li>
                ))}
                <li>☐ Wall switches and fan regulators work when the group is switched on from the website</li>
              </ul>
            </div>
            <div className="small">Installed by: ____________________ Date: ____________ Signature: ____________</div>
          </Card>
        ))}
      </div>
    </>
  )
}
