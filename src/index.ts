import {definePlugin, DocumentActionProps, isObjectInputProps} from 'sanity'

import {AssignWorkflow} from './actions/AssignWorkflow'
import {BeginWorkflow} from './actions/BeginWorkflow'
import {CompleteWorkflow} from './actions/CompleteWorkflow'
import {NextStateAction} from './actions/NextStateAction'
import {PublishAction} from './actions/PublishAction'
import {UpdateWorkflow} from './actions/UpdateWorkflow'
import {AssigneesBadge} from './badges/AssigneesBadge'
import {StateBadge} from './badges/StateBadge'
import {WorkflowProvider} from './components/WorkflowContext'
import WorkflowSignal from './components/WorkflowSignal'
import {DEFAULT_CONFIG} from './constants'
import metadata from './schema/workflow/workflow.metadata'
import {workflowTool} from './tools'
import {WorkflowConfig} from './types'

export const workflow = definePlugin<WorkflowConfig>(
  (config = DEFAULT_CONFIG) => {
    const {schemaTypes, states} = {...DEFAULT_CONFIG, ...config}

    if (!states?.length) {
      throw new Error(`Workflow plugin: Missing "states" in config`)
    }

    if (!schemaTypes?.length) {
      throw new Error(`Workflow plugin: Missing "schemaTypes" in config`)
    }

    return {
      name: 'sanity-plugin-workflow',
      schema: {
        types: [metadata(states)],
      },
      // TODO: Remove 'workflow.metadata' from list of new document types
      // ...
      studio: {
        components: {
          layout: (props) =>
            WorkflowProvider({...props, workflow: {schemaTypes, states}}),
        },
      },
      form: {
        components: {
          input: (props) => {
            if (
              props.id === `root` &&
              isObjectInputProps(props) &&
              schemaTypes.includes(props.schemaType.name)
            ) {
              return WorkflowSignal(props)
            }

            return props.renderDefault(props)
          },
        },
      },
      document: {
        actions: (prev, context) => {
          if (!schemaTypes.includes(context.schemaType)) {
            return prev
          }

          // Order of actions:
          /// 1. By default, the first action is "publish",
          ///    then comes the begin workflow action
          ///    and finally the rest of the native actions
          /// 2. If a workflow has started, and if no one has been assigned,
          ///    the first action is "assign",
          ///    then the workflow actions,
          ///    and finally all of the native actions (including "publish")
          /// 3. If the workflow has started, and there are assignees,
          ///    the first action is the next action in the workflow,
          ///    then the rest of the workflow actions,
          ///    and finally all of the native actions (including "publish")
          // Combined, the order is:
          /// 1. Primary publish (only visible if not in workflow)
          /// 2. Begin workflow (only visible if not in workflow, and there have been changes)
          /// 3. Primary assign (only visible if in workflow and no assignees)
          /// 4. Next state action (only visible if in workflow and with assignees)
          /// 5. Secondary assign (only visible if in workflow and with assignees)
          /// 6. Update workflow actions (only visible if in workflow, shows all states the document can be updated to)
          /// 7. Complete workflow (only visible if in workflow, disabled if not approved)
          /// 8. Secondary publish (only visible if in a workflow)
          /// 9. Unpublish, Discard changes, Duplicate, Delete
          const [publishAction, ...nativeActions] = prev
          return [
            (props) => PublishAction(props, publishAction, true),
            (props) => BeginWorkflow(props),
            (props) => AssignWorkflow(props, true),
            (props) => NextStateAction(props),
            (props) => AssignWorkflow(props, false),
            ...states.map(
              (state) => (props: DocumentActionProps) =>
                UpdateWorkflow(props, state)
            ),
            (props) => CompleteWorkflow(props),
            (props) => PublishAction(props, publishAction, false),
            ...nativeActions,
          ]
        },
        badges: (prev, context) => {
          if (!schemaTypes.includes(context.schemaType)) {
            return prev
          }

          const {documentId, currentUser} = context

          if (!documentId) {
            return prev
          }

          return [
            () => StateBadge(documentId),
            () => AssigneesBadge(documentId, currentUser),
            ...prev,
          ]
        },
      },
      tools: [
        // TODO: These configs could be read from Context
        workflowTool({schemaTypes, states}),
      ],
    }
  }
)
