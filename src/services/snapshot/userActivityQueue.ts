/**
 * Student User Activity Synchronization Queue
 * Manages offline student interactions, durable outbox buffering, and batched Firestore uploads.
 * Operates completely independently from content snapshot sync.
 */

import { UserActivityEvent } from "./types";
import {
  SNAPSHOT_STORES,
  executeTx,
  openSnapshotDb
} from "./indexedDbV5";
import { supabase } from "../../lib/supabase";

export interface BatchFlushResult {
  flushedCount: number;
  remainingCount: number;
  success: boolean;
  error?: string;
}

export class UserActivityQueue {
  private isFlushing: boolean = false;
  private maxBatchSize: number = 50;

  /**
   * Enqueue a student activity event into the durable IndexedDB outbox.
   */
  public async enqueueEvent(
    userId: string,
    eventType: UserActivityEvent["eventType"],
    entityId: string,
    operation: UserActivityEvent["operation"],
    payload: any
  ): Promise<string> {
    const eventId = `${userId}_${eventType}_${entityId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const event: UserActivityEvent = {
      eventId,
      userId,
      eventType,
      entityId,
      operation,
      payload,
      clientTimestamp: Date.now(),
      syncStatus: "pending",
      retryCount: 0
    };

    // Store in pending_sync_queue
    await executeTx(SNAPSHOT_STORES.PENDING_SYNC_QUEUE, "readwrite", async (stores) => {
      stores[SNAPSHOT_STORES.PENDING_SYNC_QUEUE].put(event);
    });

    // Also update local dedicated store immediately for offline access
    await this.updateLocalActivityStore(event);

    return eventId;
  }

  /**
   * Update the dedicated local activity store so the UI is immediately responsive offline.
   */
  private async updateLocalActivityStore(event: UserActivityEvent): Promise<void> {
    const { userId, eventType, entityId, payload } = event;

    try {
      if (eventType === "bookmark") {
        await executeTx(SNAPSHOT_STORES.BOOKMARKS, "readwrite", async (stores) => {
          stores[SNAPSHOT_STORES.BOOKMARKS].put({
            id: `${userId}_${entityId}`,
            userId,
            questionId: entityId,
            bookmarked: payload.bookmarked ?? true,
            updatedAt: Date.now()
          });
        });
      } else if (eventType === "wrong_question") {
        await executeTx(SNAPSHOT_STORES.WRONG_QUESTIONS, "readwrite", async (stores) => {
          stores[SNAPSHOT_STORES.WRONG_QUESTIONS].put({
            id: `${userId}_${entityId}`,
            userId,
            questionId: entityId,
            topicId: payload.topicId,
            wrongCount: payload.wrongCount || 1,
            lastWrongAt: Date.now(),
            reviewStatus: payload.reviewStatus || "needs_review"
          });
        });
      } else if (eventType === "attempt") {
        await executeTx(SNAPSHOT_STORES.ATTEMPT_HISTORY, "readwrite", async (stores) => {
          stores[SNAPSHOT_STORES.ATTEMPT_HISTORY].put({
            id: `${userId}_${entityId}_${Date.now()}`,
            userId,
            questionId: entityId,
            selectedOption: payload.selectedOption,
            isCorrect: payload.isCorrect,
            timeSpentSeconds: payload.timeSpentSeconds || 0,
            timestamp: Date.now()
          });
        });
      } else if (eventType === "test_result") {
        await executeTx(SNAPSHOT_STORES.TEST_HISTORY, "readwrite", async (stores) => {
          stores[SNAPSHOT_STORES.TEST_HISTORY].put({
            id: entityId,
            userId,
            testId: payload.testId || entityId,
            score: payload.score,
            totalQuestions: payload.totalQuestions,
            completedAt: Date.now(),
            details: payload
          });
        });
      }
    } catch (err: any) {
      console.warn(`[UserActivityQueue] Local activity store update warning: ${err.message}`);
    }
  }

  /**
   * Flushes pending events in batches to Firestore with deduplication and idempotency.
   */
  public async flushPendingQueue(): Promise<BatchFlushResult> {
    if (this.isFlushing) {
      return { flushedCount: 0, remainingCount: 0, success: true };
    }
    this.isFlushing = true;

    try {
      const dbInstance = await openSnapshotDb();
      const pendingEvents: UserActivityEvent[] = await new Promise((resolve, reject) => {
        const tx = dbInstance.transaction([SNAPSHOT_STORES.PENDING_SYNC_QUEUE], "readonly");
        const store = tx.objectStore(SNAPSHOT_STORES.PENDING_SYNC_QUEUE);
        const index = store.index("syncStatus");
        const req = index.getAll("pending");
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (pendingEvents.length === 0) {
        return { flushedCount: 0, remainingCount: 0, success: true };
      }

      // Take batch up to maxBatchSize
      const batchToFlush = pendingEvents.slice(0, this.maxBatchSize);

      const acknowledgedIds: string[] = [];

      for (const ev of batchToFlush) {
        try {
          if (ev.eventType === "attempt" && (ev.payload?.questionId || ev.payload?.topicId)) {
            const attemptRow: any = {
              user_id: ev.userId,
              topic_id: ev.payload.topicId || null,
              subject_id: ev.payload.subjectId || null,
              score: typeof ev.payload.score === "number" ? Math.round(ev.payload.score) : (ev.payload.isCorrect ? 1 : 0),
              total_questions: ev.payload.totalQuestions || 1,
              answers: ev.payload.answers || (ev.payload.questionId ? {
                [ev.payload.questionId]: {
                  selectedOption: ev.payload.selectedOption,
                  isCorrect: ev.payload.isCorrect
                }
              } : {}),
              time_spent_seconds: ev.payload.timeSpentSeconds || ev.payload.timeSpent || 0,
            };

            const { error: attErr } = await supabase.from("attempts").insert(attemptRow);
            if (!attErr) {
              acknowledgedIds.push(ev.eventId);
            } else {
              console.warn("[UserActivityQueue] Attempt sync rejected by Supabase:", attErr.message);
            }
          } else if (ev.eventType === "bookmark" && ev.entityId) {
            let bErr: any = null;
            if (ev.operation === "delete") {
              const { error } = await supabase.from("bookmarks").delete().match({ user_id: ev.userId, question_id: ev.entityId });
              bErr = error;
            } else {
              const { error } = await supabase.from("bookmarks").upsert({ user_id: ev.userId, question_id: ev.entityId }, { onConflict: "user_id,question_id" });
              bErr = error;
            }
            if (!bErr) {
              acknowledgedIds.push(ev.eventId);
            } else {
              console.warn("[UserActivityQueue] Bookmark sync rejected by Supabase:", bErr.message);
            }
          }
        } catch (syncErr) {
          console.warn("[UserActivityQueue] Supabase sync event warning:", syncErr);
        }
      }

      // Remove only successfully acknowledged events from queue
      if (acknowledgedIds.length > 0) {
        await executeTx(SNAPSHOT_STORES.PENDING_SYNC_QUEUE, "readwrite", async (stores) => {
          const store = stores[SNAPSHOT_STORES.PENDING_SYNC_QUEUE];
          for (const evId of acknowledgedIds) {
            store.delete(evId);
          }
        });
      }

      const remaining = pendingEvents.length - acknowledgedIds.length;
      return {
        flushedCount: acknowledgedIds.length,
        remainingCount: remaining,
        success: acknowledgedIds.length > 0 || batchToFlush.length === 0
      };
    } catch (err: any) {
      console.warn(`[UserActivityQueue] Batch flush failed: ${err.message}`);
      return {
        flushedCount: 0,
        remainingCount: 0,
        success: false,
        error: err.message
      };
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Get count of pending outbox events.
   */
  public async getPendingCount(): Promise<number> {
    const dbInstance = await openSnapshotDb();
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction([SNAPSHOT_STORES.PENDING_SYNC_QUEUE], "readonly");
      const store = tx.objectStore(SNAPSHOT_STORES.PENDING_SYNC_QUEUE);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  }
}

export const defaultUserActivityQueue = new UserActivityQueue();
