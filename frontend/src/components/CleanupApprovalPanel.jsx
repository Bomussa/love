import React, { useEffect, useMemo, useState } from 'react';
import authService, { USER_ROLES } from '../lib/auth-service';
import { RefreshCw, CheckCircle, XCircle, MessageCircle, Play, Shield } from 'lucide-react';
import {
  loadCleanupPolicy,
  loadCleanupRequests,
  saveCleanupRequests,
  scanCleanupCandidates,
  createCleanupRequest,
  reviewCleanupRequest,
  executeCleanupRequest,
  loadReviewerRecords,
  recordReviewerCheck,
} from '../lib/cleanup-workflow';
import { supabase } from '../lib/supabase-client';

const CleanupApprovalPanel = ({ language = 'ar' }) => {
  const isAr = language === 'ar';
  const [policy, setPolicy] = useState(null);
  const [requests, setRequests] = useState([]);
  const [reviewers, setReviewers] = useState({});
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentDraft, setCommentDraft] = useState('');

  const session = authService.getSession();
  const isSuperAdmin = session?.role === USER_ROLES.SUPER_ADMIN.id;

  const loadAll = async () => {
    setLoading(true);
    const [p, r, rev] = await Promise.all([
      loadCleanupPolicy(),
      loadCleanupRequests(),
      loadReviewerRecords(),
    ]);
    setPolicy(p);
    setRequests(r);
    setReviewers(rev);

    // load docs (same source as FilesCenter)
    const { data } = await supabase
      .from('system_docs')
      .select('id,name,name_ar,category,path,content,description,updated_at');
    setDocs((data || []).map((d) => ({
      id: d.id,
      fullName: d.name || d.name_ar,
      name: d.name_ar || d.name,
      category: d.category,
      path: d.path,
      content: d.content,
      description: d.description,
      updated_at: d.updated_at,
    })));

    if (session?.username) {
      await recordReviewerCheck({
        reviewerKey: session.username,
        reviewerName: session.username,
        reviewerRole: session.role,
        decision: 'check',
      });
    }

    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const staleItems = useMemo(() => scanCleanupCandidates(docs, policy || {}), [docs, policy]);

  const createRequest = async () => {
    if (!staleItems.length) return;
    await createCleanupRequest({
      requester: session?.username,
      requesterRole: session?.role,
      reason: 'Auto-detected stale or unused items > 90 days',
      items: staleItems,
    });
    await loadAll();
  };

  const handleDecision = async (id, decision) => {
    if (!isSuperAdmin) return;
    await reviewCleanupRequest({
      requestId: id,
      decision,
      reviewer: session?.username,
      reviewerRole: session?.role,
      comment: commentDraft,
    });
    setCommentDraft('');
    await loadAll();
  };

  const handleExecute = async (id) => {
    if (!isSuperAdmin) return;
    await executeCleanupRequest(id);
    await loadAll();
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="p-4 border rounded-xl mb-6" style={{ borderColor: '#C9A54C55' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          <Shield size={18} /> {isAr ? 'نظام التنظيف والموافقة' : 'Cleanup & Approval'}
        </h3>
        <button onClick={loadAll}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      <div className="mb-3 text-sm">
        {isAr ? 'العناصر القديمة المكتشفة:' : 'Detected stale items:'} {staleItems.length}
      </div>

      <button
        onClick={createRequest}
        className="px-3 py-2 bg-[#8A1538] text-white rounded-lg mb-4"
      >
        {isAr ? 'إنشاء طلب تنظيف' : 'Create Cleanup Request'}
      </button>

      <div className="space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="p-3 border rounded-lg">
            <div className="text-xs mb-1">{r.id}</div>
            <div className="text-sm mb-2">
              {isAr ? 'الحالة:' : 'Status:'} {r.status} — {r.items?.length || 0} items
            </div>

            <textarea
              placeholder={isAr ? 'تعليق...' : 'Comment...'}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              className="w-full text-xs mb-2 p-2 bg-black/20 rounded"
            />

            <div className="flex gap-2 flex-wrap">
              <button onClick={() => handleDecision(r.id, 'approved')} className="bg-green-600 text-white px-2 py-1 rounded text-xs"><CheckCircle size={12} /> {isAr ? 'موافقة' : 'Approve'}</button>
              <button onClick={() => handleDecision(r.id, 'rejected')} className="bg-red-600 text-white px-2 py-1 rounded text-xs"><XCircle size={12} /> {isAr ? 'رفض' : 'Reject'}</button>
              <button onClick={() => handleDecision(r.id, 'commented')} className="bg-yellow-600 text-white px-2 py-1 rounded text-xs"><MessageCircle size={12} /> {isAr ? 'تعليق' : 'Comment'}</button>
              {r.status === 'approved' && (
                <button onClick={() => handleExecute(r.id)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs"><Play size={12} /> {isAr ? 'تنفيذ' : 'Execute'}</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CleanupApprovalPanel;
