import { FeatureDetailPage, buildFeatureMetadata } from "@/components/marketing/feature-detail-page";
import { getFeatureBySlug } from "@/lib/marketing/features";

const feature = getFeatureBySlug("security");

export const metadata = buildFeatureMetadata(feature);

export default function SecurityFeaturePage() {
  return <FeatureDetailPage feature={feature} />;
}
