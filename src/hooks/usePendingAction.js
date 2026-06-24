import { supabase } from '../lib/supabase'

export async function requestAction({ empId, action, entityType, entityId, entityRef, entityLabel, changes }) {
  try {
    await supabase.from('pending_actions').insert({
      emp_id: empId || null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_ref: entityRef || null,
      entity_label: entityLabel || null,
      changes: changes || null,
      status: 'pending'
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
