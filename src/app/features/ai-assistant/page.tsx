import { FeatureDetailPage, buildFeatureMetadata } from "@/components/marketing/feature-detail-page";
import { getFeatureBySlug } from "@/lib/marketing/features";

const feature = getFeatureBySlug("ai-assistant");

export const metadata = buildFeatureMetadata(feature);

export default function AiAssistantFeaturePage() {
  return <FeatureDetailPage feature={feature} />;
}
