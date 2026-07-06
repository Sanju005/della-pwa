import { getProfileOverviewData } from "@/lib/profile-service";

import { RewardsScreen } from "../_components/profile-ui";

export default async function ProfileRewardsPage() {
  const data = await getProfileOverviewData();
  return <RewardsScreen initialData={data} />;
}
