import { getEditableProfileData } from "@/lib/profile-service";

import { CustomerEmailVerificationScreen } from "../../_components/profile-ui";

export default async function ProfileEmailVerificationPage() {
  const profile = await getEditableProfileData();
  return <CustomerEmailVerificationScreen initialProfile={profile} />;
}
