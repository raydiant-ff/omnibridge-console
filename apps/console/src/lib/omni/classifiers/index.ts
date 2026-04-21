/**
 * Omni subscription classifiers — pure functions, no side effects.
 * Consumes OmniSubscriptionFacts; produces OmniSubscriptionClassificationResult.
 */

export { classifySubscription } from "./classify-subscription";
export {
  CLASSIFICATION_LABELS,
  CLASSIFICATION_EXPLANATIONS,
} from "./explain-classification";
