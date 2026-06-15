import { FeatureDetailPage, buildFeatureMetadata } from "@/components/marketing/feature-detail-page";
import { getFeatureBySlug } from "@/lib/marketing/features";

const feature = getFeatureBySlug("billing");

export const metadata = buildFeatureMetadata(feature);

export default function BillingFeaturePage() {
  return <FeatureDetailPage feature={feature} />;
}
