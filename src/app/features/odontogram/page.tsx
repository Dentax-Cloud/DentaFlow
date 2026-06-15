import { FeatureDetailPage, buildFeatureMetadata } from "@/components/marketing/feature-detail-page";
import { getFeatureBySlug } from "@/lib/marketing/features";

const feature = getFeatureBySlug("odontogram");

export const metadata = buildFeatureMetadata(feature);

export default function OdontogramFeaturePage() {
  return <FeatureDetailPage feature={feature} />;
}
