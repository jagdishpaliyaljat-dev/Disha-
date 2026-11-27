/**
 * In-App Rating & Review Trigger Service (ASO Booster)
 *
 * Automatically detects high-performing student moments (exam completion >= threshold)
 * and displays a smart sentiment-routed Play Store review prompt.
 */

import { appConfigService, InAppReviewConfig } from './appConfigService';

const STORAGE_KEYS = {
  HAS_REVIEWED: 'disha_playstore_reviewed',
  SNOOZE_UNTIL: 'disha_review_prompt_snooze',
  TESTS_COUNT: 'disha_completed_tests_count',
};

class RatingReviewService {
  private static instance: RatingReviewService;

  public static getInstance(): RatingReviewService {
    if (!RatingReviewService.instance) {
      RatingReviewService.instance = new RatingReviewService();
    }
    return RatingReviewService.instance;
  }

  /**
   * Increments and returns the total number of tests/exams completed by the user.
   */
  public recordTestCompletion(): number {
    try {
      const current = parseInt(localStorage.getItem(STORAGE_KEYS.TESTS_COUNT) || '0', 10);
      const next = current + 1;
      localStorage.setItem(STORAGE_KEYS.TESTS_COUNT, next.toString());
      return next;
    } catch {
      return 1;
    }
  }

  /**
   * Returns current count of completed tests.
   */
  public getCompletedTestsCount(): number {
    try {
      return parseInt(localStorage.getItem(STORAGE_KEYS.TESTS_COUNT) || '0', 10);
    } catch {
      return 0;
    }
  }

  /**
   * Checks if user is eligible for an in-app review prompt.
   * Criteria:
   * 1. Feature enabled in app config
   * 2. User hasn't already given a review/rated
   * 3. Snooze period has expired
   * 4. User has completed at least minTestsCompleted
   * 5. Score is >= minScorePercent
   */
  public shouldTriggerReviewPrompt(scorePercent: number): boolean {
    try {
      const config = appConfigService.getConfig();
      const reviewCfg: InAppReviewConfig = config.reviewConfig || {
        enabled: true,
        minScorePercent: 75,
        minTestsCompleted: 2,
        snoozeDays: 5,
        smartSentimentRouting: true,
      };

      if (!reviewCfg.enabled) return false;

      // Already rated
      if (localStorage.getItem(STORAGE_KEYS.HAS_REVIEWED) === 'true') {
        return false;
      }

      // Snoozed
      const snoozeUntil = localStorage.getItem(STORAGE_KEYS.SNOOZE_UNTIL);
      if (snoozeUntil) {
        const snoozeTimestamp = parseInt(snoozeUntil, 10);
        if (Date.now() < snoozeTimestamp) {
          return false;
        }
      }

      // Check tests count
      const testsCount = this.getCompletedTestsCount();
      if (testsCount < (reviewCfg.minTestsCompleted || 2)) {
        return false;
      }

      // Check score percentage threshold
      if (scorePercent < (reviewCfg.minScorePercent || 75)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Mark as reviewed so the prompt is never shown again.
   */
  public markAsReviewed() {
    try {
      localStorage.setItem(STORAGE_KEYS.HAS_REVIEWED, 'true');
    } catch {
      // ignore
    }
  }

  /**
   * Snooze review prompt for the configured number of days.
   */
  public snoozePrompt(days: number = 5) {
    try {
      const snoozeUntil = Date.now() + days * 24 * 60 * 60 * 1000;
      localStorage.setItem(STORAGE_KEYS.SNOOZE_UNTIL, snoozeUntil.toString());
    } catch {
      // ignore
    }
  }

  /**
   * Reset review status (primarily for testing in admin panel).
   */
  public resetReviewStatus() {
    try {
      localStorage.removeItem(STORAGE_KEYS.HAS_REVIEWED);
      localStorage.removeItem(STORAGE_KEYS.SNOOZE_UNTIL);
    } catch {
      // ignore
    }
  }
}

export const ratingReviewService = RatingReviewService.getInstance();
