import { getEditableProfileData } from "@/lib/profile-service";

import { CustomerVerificationHubScreen } from "../_components/profile-ui";

export default async function ProfileVerificationPage() {
  const profile = await getEditableProfileData();
  return <CustomerVerificationHubScreen initialProfile={profile} />;
}
