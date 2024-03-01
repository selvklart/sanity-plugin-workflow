import {DocumentActionComponent, DocumentActionProps} from 'sanity'

import {useWorkflowContext} from '../components/WorkflowContext'

export const PublishAction = (
  props: DocumentActionProps,
  originalPublishAction: DocumentActionComponent,
  primary: boolean
) => {
  const {id} = props
  const {metadata} = useWorkflowContext(id)
  const action = originalPublishAction(props)
  if (primary) {
    return metadata ? null : action
  }

  return metadata ? action : null
}
