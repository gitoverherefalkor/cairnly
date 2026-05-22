import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Lightweight "thumbs up" feedback on AI chat replies and report-section
// content. A row in `content_feedback` means the current user marked that
// piece of content as impressive. Toggling off deletes the row. We snapshot
// the content text so we can learn from WHAT impressed people, not just that
// something did.
//
// The `content_feedback` table isn't in the generated Supabase types yet, so
// queries are cast to `any` — same pattern used elsewhere in the app for
// recently-added columns.
const feedbackTable = () => (supabase as any).from('content_feedback');

export type FeedbackTargetType = 'chat_message' | 'report_section';

const keyOf = (targetType: FeedbackTargetType, targetId: string) =>
  `${targetType}:${targetId}`;

export function useContentFeedback(reportId?: string, userId?: string) {
  // Set of "type:id" keys the user has thumbed up.
  const [likedKeys, setLikedKeys] = useState<Set<string>>(new Set());

  // Load existing feedback for this report so the thumbs render filled on
  // a returning visit (works for persisted messages whose ids survive reload).
  useEffect(() => {
    let cancelled = false;
    if (!reportId) {
      setLikedKeys(new Set());
      return;
    }
    (async () => {
      const { data, error } = await feedbackTable()
        .select('target_type, target_id')
        .eq('report_id', reportId);
      if (cancelled) return;
      if (error) {
        console.error('Failed to load content feedback:', error);
        return;
      }
      const next = new Set<string>();
      (data ?? []).forEach((row: any) => next.add(keyOf(row.target_type, row.target_id)));
      setLikedKeys(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const isLiked = useCallback(
    (targetType: FeedbackTargetType, targetId: string) =>
      likedKeys.has(keyOf(targetType, targetId)),
    [likedKeys]
  );

  const toggleFeedback = useCallback(
    async (targetType: FeedbackTargetType, targetId: string, snapshot: string) => {
      if (!userId) return;
      const key = keyOf(targetType, targetId);
      const currentlyLiked = likedKeys.has(key);

      // Optimistic update so the UI feels instant.
      setLikedKeys((prev) => {
        const next = new Set(prev);
        if (currentlyLiked) next.delete(key);
        else next.add(key);
        return next;
      });

      if (currentlyLiked) {
        const { error } = await feedbackTable()
          .delete()
          .eq('user_id', userId)
          .eq('target_type', targetType)
          .eq('target_id', targetId);
        if (error) {
          console.error('Failed to remove feedback:', error);
          setLikedKeys((prev) => new Set(prev).add(key)); // revert
        }
      } else {
        const { error } = await feedbackTable().insert({
          user_id: userId,
          report_id: reportId ?? null,
          target_type: targetType,
          target_id: targetId,
          rating: 'up',
          content_snapshot: snapshot?.slice(0, 8000) ?? null,
        });
        if (error) {
          console.error('Failed to save feedback:', error);
          setLikedKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      }
    },
    [likedKeys, reportId, userId]
  );

  return { isLiked, toggleFeedback };
}
