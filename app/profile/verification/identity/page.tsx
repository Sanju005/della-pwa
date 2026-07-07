import { getEditableProfileData } from "@/lib/profile-service";

import { CustomerIdentityVerificationScreen } from "../../_components/profile-ui";

export default async function ProfileIdentityVerificationPage() {
  const profile = await getEditableProfileData();
  return <CustomerIdentityVerificationScreen initialProfile={profile} />;
}
