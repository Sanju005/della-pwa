import { getEditableProfileData } from "@/lib/profile-service";

import { CustomerPhoneVerificationScreen } from "../../_components/profile-ui";

export default async function ProfilePhoneVerificationPage() {
  const profile = await getEditableProfileData();
  return <CustomerPhoneVerificationScreen initialProfile={profile} />;
}
