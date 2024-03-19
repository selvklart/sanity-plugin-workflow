import {RemoveCircleIcon} from '@sanity/icons'
import {useToast} from '@sanity/ui'
import {useCallback, useState} from 'react'
import {DocumentActionProps, useClient} from 'sanity'

import {useWorkflowContext} from '../components/WorkflowContext'
import {API_VERSION} from '../constants'

export function CancelWorkflow(props: DocumentActionProps) {
  const {id, draft} = props
  const {metadata, loading, error, states} = useWorkflowContext(id)
  const client = useClient({apiVersion: API_VERSION})
  const toast = useToast()
  const [cancelling, setCancelling] = useState(false)

  if (error) {
    console.error(error)
  }

  const handle = useCallback(() => {
    setCancelling(true)
    client.delete(`workflow-metadata.${id}`).then(() => {
      toast.push({
        status: 'success',
        title: 'Workflow cancelled',
      })
      setCancelling(false)
    })
  }, [id, states, client, toast])

  if (!draft || !metadata) {
    return null
  }

  return {
    icon: RemoveCircleIcon,
    type: 'dialog',
    tone: 'default',
    disabled: loading || error || cancelling,
    label: cancelling ? `Cancelling...` : `Cancel Workflow`,
    onHandle: () => {
      handle()
    },
  }
}
