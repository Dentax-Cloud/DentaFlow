import { FeatureDetailPage, buildFeatureMetadata } from "@/components/marketing/feature-detail-page";
import { getFeatureBySlug } from "@/lib/marketing/features";

const feature = getFeatureBySlug("scheduling");

export const metadata = buildFeatureMetadata(feature);

export default function SchedulingFeaturePage() {
  return <FeatureDetailPage feature={feature} />;
}
