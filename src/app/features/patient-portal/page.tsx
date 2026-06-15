import { FeatureDetailPage, buildFeatureMetadata } from "@/components/marketing/feature-detail-page";
import { getFeatureBySlug } from "@/lib/marketing/features";

const feature = getFeatureBySlug("patient-portal");

export const metadata = buildFeatureMetadata(feature);

export default function PatientPortalFeaturePage() {
  return <FeatureDetailPage feature={feature} />;
}
