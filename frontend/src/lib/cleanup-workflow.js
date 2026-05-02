import { supabase, getSystemSetting, setSystemSetting } from './supabase-client';

const CLEANUP_REQUESTS_KEY = 'cleanup_requests_v1';
const REVIEWER_RECORDS_KEY = 'reviewer_records_v1';
const ARCHIVED_DOC_IDS_KEY = 'archived_system_docs_v1';
const CLEANUP_POLICY_KEY = 'cleanup_policy_v1';

const DEFAULT_POLICY = {
  staleDays: 90,
  archiveMode: 'soft',
  includeUnreferenced: true,
  includeOldDocs: true,
  requireSuperAdminApproval: true,
};

const safeArray = (value) => (Array.isArray(value) ? value : []);
const safeObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

async function appendActivity(actionType, description, metadata = {}, userId = null) {
  try {
    await supabase.from('activity_logs').insert([
      {
        action_type: actionType,
        description,
        user_id: userId,
        metadata,
        ip_address: null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (error) {
    console.warn('[cleanup-workflow] activity log failed:', error?.message || error);
  }
}

export async function loadCleanupPolicy() {
  const value = await getSystemSetting(CLEANUP_POLICY_KEY, DEFAULT_POLICY);
  return { ...DEFAULT_POLICY, ...(safeObject(value)) };
}

export async function saveCleanupPolicy(policy) {
  const next = { ...DEFAULT_POLICY, ...(safeObject(policy)) };
  await setSystemSetting(CLEANUP_POLICY_KEY, next, 'Cleanup policy for approval-based archival');
  return next;
}

export async function loadCleanupRequests() {
  const value = await getSystemSetting(CLEANUP_REQUESTS_KEY, []);
  return safeArray(value);
}

export async function saveCleanupRequests(requests) {
  const next = safeArray(requests);
  await setSystemSetting(CLEANUP_REQUESTS_KEY, next, 'Cleanup requests queue');
  return next;
}

export async function loadReviewerRecords() {
  const value = await getSystemSetting(REVIEWER_RECORDS_KEY, {});
  return safeObject(value);
}

export async function saveReviewerRecords(records) {
  const next = safeObject(records);
  await setSystemSetting(REVIEWER_RECORDS_KEY, next, 'Persistent reviewer check records');
  return next;
}

export async function loadArchivedDocIds() {
  const value = await getSystemSetting(ARCHIVED_DOC_IDS_KEY, []);
  return new Set(safeArray(value).map((id) => String(id)));
}

export async function saveArchivedDocIds(ids) {
  const next = Array.from(new Set(safeArray(ids).map((id) => String(id))));
  await setSystemSetting(ARCHIVED_DOC_IDS_KEY, next, 'Soft-archived system document ids');
  return new Set(next);
}

export function scanCleanupCandidates(docs = [], policy = DEFAULT_POLICY) {
  const staleDays = Number(policy?.staleDays || DEFAULT_POLICY.staleDays);
  const thresholdMs = staleDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  return docs
    .map((doc) => {
      const updatedAt = doc.updated_at ? new Date(doc.updated_at).getTime() : 0;
      const ageDays = updatedAt ? Math.max(0, Math.floor((now - updatedAt) / (24 * 60 * 60 * 1000))) : null;
      const isOld = updatedAt ? (now - updatedAt) >= thresholdMs : true;
      const isUnused = String(doc.description || '').toLowerCase().includes('unused') || String(doc.content || '').trim().length === 0;

      return {
        item_type: 'system_doc',
        item_identifier: String(doc.id),
        item_name: doc.fullName || doc.name || doc.name_ar || doc.id,
        current_path: doc.path || '',
        last_seen_at: doc.updated_at || null,
        age_days: ageDays,
        is_unused: isUnused,
        action: 'archive',
        metadata: {
          category: doc.category || 'docs',
          path: doc.path || '',
          original_doc: doc,
        },
        qualifies: isOld || isUnused,
      };
    })
    .filter((item) => item.qualifies);
}

export async function createCleanupRequest({
  requester,
  requesterRole,
  reason,
  items,
  targetScope = 'system',
  targetType = 'system_docs',
}) {
  const requests = await loadCleanupRequests();
  const request = {
    id: `cleanup_${Date.now()}`,
    target_scope: targetScope,
    target_type: targetType,
    status: 'pending',
    requested_by: requester || 'unknown',
    requested_by_role: requesterRole || 'unknown',
    approved_by: null,
    approved_by_role: null,
    requested_at: new Date().toISOString(),
    reviewed_at: null,
    executed_at: null,
    review_comment: '',
    reason: reason || 'Stale or unused items detected',
    metadata: {
      itemCount: safeArray(items).length,
      preview: safeArray(items).slice(0, 20),
    },
    items: safeArray(items).map((item) => ({
      ...item,
      status: 'pending',
    })),
  };

  requests.unshift(request);
  await saveCleanupRequests(requests);
  await appendActivity('cleanup_request_created', `Created cleanup request ${request.id}`, {
    requestId: request.id,
    itemCount: request.items.length,
    reason: request.reason,
  });
  return request;
}

export async function recordReviewerCheck({ reviewerKey, reviewerName, reviewerRole, decision = 'check', comment = '' }) {
  const records = await loadReviewerRecords();
  const key = String(reviewerKey || reviewerName || 'unknown').trim().toLowerCase();
  const existing = records[key] || {
    reviewer_key: key,
    reviewer_name: reviewerName || key,
    reviewer_role: reviewerRole || 'unknown',
    review_count: 0,
    check_count: 0,
    last_decision: null,
    last_comment: null,
    last_reviewed_at: null,
    metadata: {},
  };

  const next = {
    ...existing,
    reviewer_name: reviewerName || existing.reviewer_name,
    reviewer_role: reviewerRole || existing.reviewer_role,
    check_count: existing.check_count + 1,
    review_count: decision === 'approved' || decision === 'rejected' || decision === 'commented' ? existing.review_count + 1 : existing.review_count,
    last_decision: decision,
    last_comment: comment || '',
    last_reviewed_at: new Date().toISOString(),
    metadata: {
      ...(existing.metadata || {}),
      lastSeenRole: reviewerRole || existing.reviewer_role,
    },
  };

  records[key] = next;
  await saveReviewerRecords(records);
  await appendActivity('reviewer_record_updated', `Reviewer record updated for ${next.reviewer_name}`, {
    reviewerKey: key,
    decision,
    comment,
  });
  return next;
}

export async function reviewCleanupRequest({ requestId, decision, reviewer, reviewerRole, comment = '' }) {
  const requests = await loadCleanupRequests();
  const idx = requests.findIndex((r) => r.id === requestId);
  if (idx === -1) throw new Error('Cleanup request not found');

  const request = requests[idx];
  const normalizedDecision = String(decision || '').toLowerCase();
  if (!['approved', 'rejected', 'commented'].includes(normalizedDecision)) {
    throw new Error('Invalid cleanup decision');
  }

  request.status = normalizedDecision;
  request.review_comment = comment || request.review_comment || '';
  request.reviewed_at = new Date().toISOString();
  request.approved_by = reviewer || request.approved_by;
  request.approved_by_role = reviewerRole || request.approved_by_role;

  request.items = safeArray(request.items).map((item) => ({
    ...item,
    status: normalizedDecision,
  }));

  requests[idx] = request;
  await saveCleanupRequests(requests);
  await recordReviewerCheck({
    reviewerKey: reviewer,
    reviewerName: reviewer,
    reviewerRole,
    decision: normalizedDecision,
    comment,
  });
  await appendActivity(`cleanup_request_${normalizedDecision}`, `Cleanup request ${requestId} ${normalizedDecision}`, {
    requestId,
    decision: normalizedDecision,
    comment,
  });

  return request;
}

export async function executeCleanupRequest(requestId) {
  const requests = await loadCleanupRequests();
  const idx = requests.findIndex((r) => r.id === requestId);
  if (idx === -1) throw new Error('Cleanup request not found');

  const request = requests[idx];
  if (request.status !== 'approved') throw new Error('Cleanup request must be approved before execution');

  const archivedIds = await loadArchivedDocIds();
  const executedItems = safeArray(request.items).map((item) => ({
    ...item,
    status: 'completed',
  }));

  executedItems.forEach((item) => {
    if (item.item_type === 'system_doc') archivedIds.add(String(item.item_identifier));
  });

  request.status = 'completed';
  request.executed_at = new Date().toISOString();
  request.items = executedItems;
  requests[idx] = request;

  await saveArchivedDocIds(Array.from(archivedIds));
  await saveCleanupRequests(requests);
  await appendActivity('cleanup_request_completed', `Cleanup request ${requestId} completed`, {
    requestId,
    executedCount: executedItems.length,
  });

  return request;
}

export async function countStaleDocs(docs = [], policy = DEFAULT_POLICY) {
  return scanCleanupCandidates(docs, policy).length;
}

export async function isDocArchived(docId) {
  const archived = await loadArchivedDocIds();
  return archived.has(String(docId));
}
