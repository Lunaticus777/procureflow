import { supabase } from '../lib/supabase'

export async function logActivity({ empId, action, entityType, entityId, entityRef, description, affaireId }) {
  try {
    await supabase.from('activity_log').insert({
      emp_id: empId || null,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      entity_ref: entityRef || null,
      description,
      affaire_id: affaireId || null,
    })
  } catch (e) {
    // Silent fail - don't break the main action
  }
}
