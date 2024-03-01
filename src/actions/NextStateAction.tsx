import {ArrowRightIcon, CheckmarkIcon} from '@sanity/icons'
import {useToast} from '@sanity/ui'
import {useCallback} from 'react'
import {useCurrentUser, useDocumentOperation, useValidationStatus} from 'sanity'
import {DocumentActionProps, useClient} from 'sanity'

import {useWorkflowContext} from '../components/WorkflowContext'
import {API_VERSION} from '../constants'
import {arraysContainMatchingString} from '../helpers/arraysContainMatchingString'
import {State} from '../types'

// eslint-disable-next-line complexity
export function NextStateAction(props: DocumentActionProps) {
  const {id, type} = props
  const {publish} = useDocumentOperation(props.id, props.type)

  const user = useCurrentUser()
  const client = useClient({apiVersion: API_VERSION})
  const toast = useToast()
  const currentUser = useCurrentUser()

  const {metadata, loading, error, states} = useWorkflowContext(id)
  const currentState = states.find((s) => s.id === metadata?.state)
  const {assignees = []} = metadata ?? {}

  // TODO: Shouldn't the document action props contain this?
  const {validation, isValidating} = useValidationStatus(id, type)
  const hasValidationErrors =
    currentState?.requireValidation &&
    !isValidating &&
    validation?.length > 0 &&
    validation.find((v) => v.level === 'error')

  if (error) {
    console.error(error)
  }

  const onHandle = (documentId: string, newState: State) => {
    client
      .patch(`workflow-metadata.${documentId}`)
      .set({state: newState.id})
      .commit()
      .then(() => {
        props.onComplete()
        toast.push({
          status: 'success',
          title: `Document state now "${newState.title}"`,
        })
      })
      .catch((err) => {
        props.onComplete()
        console.error(err)
        toast.push({
          status: 'error',
          title: `Document state update failed`,
        })
      })
  }

  const onComplete = useCallback(() => {
    client.delete(`workflow-metadata.${id}`).then(() => publish.execute())
  }, [id, client, publish])

  // Remove button if:
  // Document is not in Workflow OR
  // The task has not been assigned to anyone
  if (!metadata || !metadata.assignees || metadata.assignees?.length === 0) {
    return null
  }

  const state = states.find((s) => s.id === metadata.state)
  const isLastState = state?.id === states[states.length - 1].id
  if (isLastState) {
    return {
      icon: CheckmarkIcon,
      type: 'dialog',
      disabled: loading || error || !isLastState,
      label: `Complete & Publish`,
      title: isLastState
        ? `Removes the document from the Workflow process, and publishes it`
        : `Cannot remove from workflow until in the last state`,
      onHandle: () => {
        onComplete()
      },
      tone: 'default',
    }
  }

  const nextStateIndex = states.findIndex((s) => s.id === currentState?.id) + 1
  const nextState = states[nextStateIndex]

  const DirectionIcon = ArrowRightIcon
  const directionLabel = 'Promote'

  const userRoleCanUpdateState =
    user?.roles?.length && nextState?.roles?.length
      ? // If the Action state is limited to specific roles
        // check that the current user has one of those roles
        arraysContainMatchingString(
          user.roles.map((r) => r.name),
          nextState.roles
        )
      : // No roles specified on the next state, so anyone can update
        nextState?.roles?.length !== 0

  const actionStateIsAValidTransition =
    currentState?.id && currentState?.transitions?.length
      ? // If the Current State limits transitions to specific States
        // Check that the Action State is in Current State's transitions array
        currentState.transitions.includes(nextState.id)
      : // Otherwise this isn't a problem
        true

  const userAssignmentCanUpdateState = nextState.requireAssignment
    ? // If the Action State requires assigned users
      // Check the current user ID is in the assignees array
      currentUser && assignees?.length && assignees.includes(currentUser.id)
    : // Otherwise this isn't a problem
      true

  let title = `${directionLabel} State to "${nextState.title}"`

  if (!userRoleCanUpdateState) {
    title = `Your User role cannot ${directionLabel} State to "${nextState.title}"`
  } else if (!actionStateIsAValidTransition) {
    title = `You cannot ${directionLabel} State to "${nextState.title}" from "${currentState?.title}"`
  } else if (!userAssignmentCanUpdateState) {
    title = `You must be assigned to the document to ${directionLabel} State to "${nextState.title}"`
  } else if (currentState?.requireValidation && isValidating) {
    title = `Document is validating, cannot ${directionLabel} State to "${nextState.title}"`
  } else if (hasValidationErrors) {
    title = `Document has validation errors, cannot ${directionLabel} State to "${nextState.title}"`
  }

  return {
    icon: DirectionIcon,
    disabled:
      loading ||
      error ||
      (currentState?.requireValidation && isValidating) ||
      hasValidationErrors ||
      !currentState ||
      !userRoleCanUpdateState ||
      !actionStateIsAValidTransition ||
      !userAssignmentCanUpdateState,
    title,
    label: nextState.title,
    onHandle: () => onHandle(id, nextState),
    tone: 'default',
  }
}
