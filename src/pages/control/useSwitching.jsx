import { api, errorText } from '../../api/client.js'
import { useConfirm, useToast } from '../../context/feedback.js'
import { useLive } from '../../context/LiveContext.js'

// Sends ON/OFF commands. Floor and whole-school actions first show how many groups will change.
export function useSwitching() {
  const { recordCommands } = useLive()
  const toast = useToast()
  const confirm = useConfirm()

  const send = async (target, state) => {
    try {
      const r = await api('/control', { method: 'POST', body: { target, state } })
      recordCommands(r.commands)
      if (r.queuedOffline) toast.warn(`${r.label}: ${r.queuedOffline} switch(es) are on an offline device and will turn ${state} when it is back online.`)
      return r
    } catch (err) {
      toast.error(errorText(err))
      return null
    }
  }

  const sendWithConfirm = async (target, state) => {
    let p
    try {
      p = await api('/control/preview', { method: 'POST', body: { target, state } })
    } catch (err) {
      toast.error(errorText(err))
      return null
    }
    const ok = await confirm({
      title: `Turn ${p.label === 'Whole school' ? 'the whole school' : p.label} ${state}?`,
      message: (
        <>
          <p>
            <strong>{p.groupsChanging}</strong> of {p.groupsTotal} lighting groups will change.
            {state === 'ON' && ' They are switched one after another so the power supply is not overloaded.'}
          </p>
          {p.channelsOffline > 0 && (
            <p className="small" style={{ color: 'var(--warn)' }}>
              {p.channelsOffline} switch(es) are on offline devices: they will follow when the device is back online.
            </p>
          )}
          {p.groupsNotWired > 0 && <p className="small muted">{p.groupsNotWired} group(s) are not connected to a device yet and are skipped.</p>}
        </>
      ),
      confirmLabel: `Turn ${state}`,
      tone: state === 'ON' ? 'on' : 'primary',
    })
    return ok ? send(target, state) : null
  }

  return { send, sendWithConfirm }
}
