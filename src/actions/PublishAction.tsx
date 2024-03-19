import {DocumentActionComponent, DocumentActionProps} from 'sanity'

import {useWorkflowContext} from '../components/WorkflowContext'

export const PublishAction = (
  props: DocumentActionProps,
  primary: boolean,
  originalPublishAction?: DocumentActionComponent
) => {
  const {id} = props
  const {metadata} = useWorkflowContext(id)
  if (!originalPublishAction) {
    return null
  }

  const action = originalPublishAction(props)
  if (primary) {
    return metadata ? null : action
  }
  return metadata ? action : null
}
